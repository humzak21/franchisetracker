import { createFileRoute } from "@tanstack/react-router";
import { TransactionsScreen } from "@/features/transactions/TransactionsScreen";

export const Route = createFileRoute("/transactions")({ component: TransactionsScreen });
