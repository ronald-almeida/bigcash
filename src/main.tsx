import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OperationsApp from "./OperationsApp";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OperationsApp />
  </StrictMode>,
);

