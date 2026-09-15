import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Swal from "sweetalert2";
import App from "./App.jsx";
import "./index.css";

// Use a consistent SweetAlert dialog for all existing alert() messages across
// the portal without changing the business logic in each component.
window.alert = (message) => {
  void Swal.fire({
    icon: "info",
    title: "CPLRC Notice",
    text: String(message),
    confirmButtonText: "OK",
    confirmButtonColor: "#1D4ED8",
  });
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
