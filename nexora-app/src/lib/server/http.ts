import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export function jsonError(
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details === undefined ? {} : { details }),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: jsonError("Invalid JSON request body.", 400),
    };
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      response: jsonError(
        "Request validation failed.",
        422,
        result.error.flatten()
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
