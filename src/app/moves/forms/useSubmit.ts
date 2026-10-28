import { useState } from "react";
import { errorMessage } from "@/lib/errors";

/** Runs a sheet's save or delete, keeping the error to show and closing the sheet on success. */
export function useSubmit(onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await work();
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    } finally {
      setSaving(false);
    }
  };
  return { error, saving, run, setError };
}
