import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp.jsx";
import App from "./App.jsx";
import "./styles.css";

const path = window.location.pathname.replace(/\/$/, "") || "/";
const Page = path === "/admin" ? AdminApp : App;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
