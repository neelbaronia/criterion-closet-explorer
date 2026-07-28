const RAW_DATA_BASE =
  "https://raw.githubusercontent.com/neelbaronia/criterion-closet-explorer/main/data";

async function fetchJson(filename: string) {
  const response = await fetch(`${RAW_DATA_BASE}/${filename}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CriterionClosetExplorer/0.1",
    },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${filename}: ${response.status}`);
  }
  return response.json();
}

export async function GET() {
  try {
    const [films, videos, people] = await Promise.all([
      fetchJson("films.json"),
      fetchJson("closet-videos.json"),
      fetchJson("people.json"),
    ]);
    return Response.json(
      { films, people, videos },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
        },
      },
    );
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
