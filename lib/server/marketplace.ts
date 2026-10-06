import "server-only";
import { assertAnonymousMarketplaceRecord, toMarketplaceListing } from "@/lib/marketplace-projection";
import { restrictedAnimalRecords } from "@/lib/server/restricted-demo-data";

export function getMarketplaceListings() {
  return restrictedAnimalRecords.map((record) => {
    const listing = toMarketplaceListing(record);
    assertAnonymousMarketplaceRecord(listing as unknown as Record<string, unknown>);
    return listing;
  });
}

export function getMarketplaceListing(id: string) {
  return getMarketplaceListings().find((listing) => listing.id === id);
}
