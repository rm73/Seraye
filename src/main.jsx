import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp.jsx";
import App from "./App.jsx";
import { LoginApp, RegisterApp, ResetPasswordApp } from "./AuthApp.jsx";
import FeedbackApp from "./FeedbackApp.jsx";
import "./styles.css";

const path = window.location.pathname.replace(/\/$/, "") || "/";
const pages = {
  "/admin": AdminApp,
  "/feedback": FeedbackApp,
  "/masuk": LoginApp,
  "/daftar": RegisterApp,
  "/ganti-sandi": ResetPasswordApp,
};
const Page = pages[path] ?? App;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
