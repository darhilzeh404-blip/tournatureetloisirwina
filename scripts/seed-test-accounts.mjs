import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable manquante : ${name}`);
  return value;
};

if (process.env.SEED_CONFIRM !== "CREATE_WINA_TEST_ACCOUNTS") {
  throw new Error(
    "Protection active. Définissez SEED_CONFIRM=CREATE_WINA_TEST_ACCOUNTS pour créer les comptes.",
  );
}

const supabase = createClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const accounts = [
  {
    email: process.env.SEED_CLIENT_EMAIL ?? "test.client@wina.test",
    password: required("SEED_CLIENT_PASSWORD"),
    fullName: "Client de test WINA",
    phone: "077000001",
    role: "client",
  },
  {
    email: process.env.SEED_ADMIN_EMAIL ?? "test.admin@wina.test",
    password: required("SEED_ADMIN_PASSWORD"),
    fullName: "Administrateur de test WINA",
    phone: "077000002",
    role: "admin",
  },
];

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((entry) => entry.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Trop d'utilisateurs pour rechercher le compte de seed.");
}

async function upsertAccount(account) {
  let user = await findUserByEmail(account.email);
  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, seeded_by: "wina-test-accounts" },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, seeded_by: "wina-test-accounts" },
    });
    if (error || !data.user) throw error ?? new Error("Création utilisateur impossible.");
    user = data.user;
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    full_name: account.fullName,
    email: account.email,
    phone: account.phone,
    status: "actif",
  }, { onConflict: "user_id" });
  if (profileError) throw profileError;

  const { error: removeRolesError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", user.id);
  if (removeRolesError) throw removeRolesError;

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: user.id, role: account.role });
  if (roleError) throw roleError;

  return { id: user.id, email: account.email, role: account.role };
}

const created = [];
for (const account of accounts) created.push(await upsertAccount(account));

console.table(created);
console.log("Comptes de test prêts. Les IDs ci-dessus peuvent être utilisés pour vos tests MyPVIT.");
