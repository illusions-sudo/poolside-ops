import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const session = JSON.parse(process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"] ?? "{}");
const url = process.env["VITE_SUPABASE_URL"];
const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const configured = Boolean(url && key && session.access_token);

describe.skipIf(!configured)("Inactive-only deletion (live authenticated database)", () => {
  const client = createClient(url ?? "http://localhost", key ?? "test", {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let customerId = "";
  let propertyId = "";
  beforeAll(async () => {
    const profile = await client
      .from("profiles")
      .select("organization_id")
      .eq("id", session.user.id)
      .single();
    if (profile.error) throw profile.error;
    const customer = await client
      .from("customers")
      .insert({
        organization_id: profile.data.organization_id,
        first_name: "Automated deletion guard test",
      })
      .select("id")
      .single();
    if (customer.error) throw customer.error;
    customerId = customer.data.id;
    const property = await client
      .from("properties")
      .insert({
        organization_id: profile.data.organization_id,
        customer_id: customerId,
        address: "Automated deletion guard test",
      })
      .select("id")
      .single();
    if (property.error) throw property.error;
    propertyId = property.data.id;
  });
  afterAll(async () => {
    if (!customerId) return;
    await client.from("customers").update({ active: false }).eq("id", customerId);
    const result = await client.rpc("delete_customer", { p_customer_id: customerId });
    if (result.error) throw result.error;
  });
  it("rejects permanent deletion of an active customer", async () => {
    const result = await client.rpc("delete_customer", { p_customer_id: customerId });
    expect(result.error?.code).toBe("23514");
    const direct = await client.from("customers").delete().eq("id", customerId);
    expect(direct.error?.code).toBe("23514");
  });
  it("rejects permanent deletion of an active property", async () => {
    const result = await client.rpc("delete_property", { p_property_id: propertyId });
    expect(result.error?.code).toBe("23514");
    const direct = await client.from("properties").delete().eq("id", propertyId);
    expect(direct.error?.code).toBe("23514");
  });
  it("deletes an inactive customer and its properties", async () => {
    const update = await client.from("customers").update({ active: false }).eq("id", customerId);
    expect(update.error).toBeNull();
    const result = await client.rpc("delete_customer", { p_customer_id: customerId });
    expect(result.error).toBeNull();
    const properties = await client.from("properties").select("id").eq("id", propertyId);
    expect(properties.data).toEqual([]);
    customerId = "";
  });
});
