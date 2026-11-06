import { createRoot } from "react-dom/client";
import App from "./App";
import "./theme.css";
import { installLayoutMode } from "./layout-mode";
import { registerOffline } from "./pwa";
import { UpdateBanner } from "./components/OfflinePanel";

installLayoutMode();
registerOffline();

createRoot(document.getElementById("root")!).render(<><App /><UpdateBanner /></>);
