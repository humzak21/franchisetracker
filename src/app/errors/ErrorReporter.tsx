import { useEffect } from "react";
import { useReportError } from "./useReportError";

/** Reports uncaught errors and unhandled promise rejections from anywhere in the app. */
export function ErrorReporter() {
  const report = useReportError();
  useEffect(() => {
    const onError = (event: ErrorEvent) => report(event.error ?? event.message, "error");
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason, "rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [report]);
  return null;
}
