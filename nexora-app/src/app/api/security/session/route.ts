import { NextRequest } from "next/server";

import { authorizeCompany } from "@/lib/server/authorization";
import { jsonError, jsonSuccess } from "@/lib/server/http";
import { uuidSchema } from "@/lib/server/validation";

export async function GET(request: NextRequest) {
  const requestedCompanyId =
    request.nextUrl.searchParams.get("company_id") ?? undefined;

  if (requestedCompanyId) {
    const validation = uuidSchema.safeParse(requestedCompanyId);

    if (!validation.success) {
      return jsonError("Invalid company ID.", 400);
    }
  }

  const authorization = await authorizeCompany(
    "company.view",
    requestedCompanyId
  );

  if (!authorization.ok) {
    return jsonError(
      authorization.error,
      authorization.status
    );
  }

  return jsonSuccess({
    userId: authorization.userId,
    companyId: authorization.companyId,
    permission: "company.view",
  });
}
