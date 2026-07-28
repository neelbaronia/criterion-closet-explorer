const TASTE_DATA_URL =
  "https://raw.githubusercontent.com/neelbaronia/criterion-closet-explorer/main/data/taste-map.json";

export async function GET() {
  try {
    const response = await fetch(TASTE_DATA_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CriterionClosetExplorer/0.1",
      },
    });
    if (!response.ok) {
      throw new Error(`Could not fetch taste-map.json: ${response.status}`);
    }
    return Response.json(await response.json(), {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return Response.json(
      { error: String(error) },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
