import { StartClient } from "@tanstack/start";
import { createRoot } from "react-dom/client";
import router from "./router";

const routerInstance = router;

const app = new StartClient({ router: routerInstance });

const root = createRoot(document.getElementById("app")!);

root.render(app);
