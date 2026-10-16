import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["urgency", "score", "category", "summary", "recommended_actions", "notify"],
  properties: {
    urgency: { type: "string", enum: ["faible", "moyenne", "elevee", "critique"] },
    score: { type: "integer", description: "1 (bénin) à 10 (danger immédiat)" },
    category: { type: "string" },
    summary: { type: "string" },
    recommended_actions: { type: "array", items: { type: "string" } },
    notify: { type: "array", items: { type: "string" } },
  },
};

const INSTRUCTIONS = `Tu es l'assistant de triage des incidents de WINA TOUR (transport au Gabon : VTC, bus, scolaire, circuits, billetterie).
Évalue l'urgence d'un incident décrit par un administrateur et recommande des actions concrètes, en français.
Critique = danger pour la sécurité physique (accident, agression, enfant non récupéré, malaise). Élevée = client bloqué, litige de paiement important, comportement grave du chauffeur.
Moyenne = retard, désagrément, réclamation. Faible = remarque mineure.
Si une vie est en danger, la première action doit être de contacter les secours (1300 SAMU / 177 Police) et le support WINA (066 26 48 90 / 077 11 09 95).`;

export const Route = createFileRoute("/api/admin/incident-triage")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return json({ error: "Non authentifié" }, 401);
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const userClient = createClient(url, key, {
          global: { headers: { Authorization: auth } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await userClient.auth.getUser(auth.slice(7));
        if (!u?.user) return json({ error: "Session invalide" }, 401);
        const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: u.user.id, _role: "admin" } as any);
        if (!isAdmin) return json({ error: "Réservé aux administrateurs" }, 403);

        const body = (await request.json().catch(() => null)) as
          | { description?: string; reporter?: string; service?: string }
          | null;
        const description = body?.description?.trim() ?? "";
        if (description.length < 10 || description.length > 4000)
          return json({ error: "Décrivez l'incident (10 à 4000 caractères)." }, 400);

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Service IA non configuré" }, 500);

        const input = `Signalé par : ${body?.reporter === "chauffeur" ? "un chauffeur" : "un client"}
Service : ${body?.service || "non précisé"}
Description : ${description}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            instructions: INSTRUCTIONS,
            input,
            stream: true,
            store: false,
            reasoning: { effort: "low" },
            text: { format: { type: "json_schema", name: "incident_triage", strict: true, schema: SCHEMA } },
          }),
        });

        if (!res.ok || !res.body) {
          const msg = await res.text().catch(() => "");
          console.error("[incident-triage]", res.status, msg);
          const friendly =
            res.status === 429 ? "Trop de demandes, réessayez dans un instant."
            : res.status === 402 ? "Crédits IA épuisés. Ajoutez des crédits pour continuer."
            : res.status === 403 ? "Accès au modèle IA refusé pour cet espace de travail."
            : "Le service IA est indisponible.";
          return json({ error: friendly }, res.status >= 400 ? res.status : 502);
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "", text = "", refused = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, i);
            buf = buf.slice(i + 2);
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const d = line.slice(5).trim();
              if (!d || d === "[DONE]") continue;
              try {
                const ev = JSON.parse(d);
                if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
                if (ev.type === "response.refusal.delta") refused = true;
                if (ev.type === "response.failed" || ev.type === "error") {
                  return json({ error: "L'analyse a échoué." }, 502);
                }
              } catch { /* frame partielle */ }
            }
          }
        }
        if (refused) return json({ error: "Le modèle a refusé d'analyser cet incident." }, 422);
        try {
          return json({ result: JSON.parse(text) });
        } catch {
          return json({ error: "Réponse IA illisible, réessayez." }, 502);
        }
      },
    },
  },
});
