import React from "react";
import ReactDOM from "react-dom/client";
import { LifeProvider } from "./context";
import App from "./App";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LifeProvider>
      <App />
    </LifeProvider>
  </React.StrictMode>,
);
