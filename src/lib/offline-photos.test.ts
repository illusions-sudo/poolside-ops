import { describe, expect, it } from "vitest";

import { buildPhotoPath } from "./offline-photos";

describe("buildPhotoPath", () => {
  it("nests the photo under the organization and visit", () => {
    const path = buildPhotoPath("org-1", "visit-2", "IMG_1234.jpeg");
    expect(path).toMatch(/^org-1\/visit-2\/[0-9a-f-]+\.jpeg$/);
  });

  it("lowercases the extension and falls back to jpg", () => {
    expect(buildPhotoPath("o", "v", "Photo.HEIC")).toMatch(/\.heic$/);
    expect(buildPhotoPath("o", "v", "no-extension")).toMatch(/\.jpg$/);
  });

  it("gives every photo a unique path", () => {
    expect(buildPhotoPath("o", "v", "a.jpg")).not.toBe(buildPhotoPath("o", "v", "a.jpg"));
  });
});
