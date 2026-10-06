import { NextResponse } from "next/server";
import { getMarketplaceListings } from "@/lib/server/marketplace";

export async function GET() {
  return NextResponse.json({
    data: await getMarketplaceListings(),
    privacy: {
      sourceIdentityIncluded: false,
      exactLocationIncluded: false,
      restrictedSourceJoinAllowed: false
    }
  });
}
