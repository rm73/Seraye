import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp.jsx";
import App from "./App.jsx";
import FeedbackApp from "./FeedbackApp.jsx";
import "./styles.css";

const path = window.location.pathname.replace(/\/$/, "") || "/";
const Page = path === "/admin" ? AdminApp : path === "/feedback" ? FeedbackApp : App;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
