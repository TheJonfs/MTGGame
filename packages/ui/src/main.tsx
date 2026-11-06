import { createRoot } from "react-dom/client";
import App from "./App";
import "./theme.css";
import { installLayoutMode } from "./layout-mode";

installLayoutMode();

createRoot(document.getElementById("root")!).render(<App />);
