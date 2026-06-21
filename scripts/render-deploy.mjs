const apiKey = process.env.RENDER_API_KEY;
const serviceIds = [
  ["api", process.env.RENDER_API_SERVICE_ID],
  ["web", process.env.RENDER_WEB_SERVICE_ID],
].filter((entry) => Boolean(entry[1]));

if (!apiKey) {
  console.error("Missing RENDER_API_KEY.");
  process.exit(1);
}

if (!serviceIds.length) {
  console.error("Missing RENDER_API_SERVICE_ID and RENDER_WEB_SERVICE_ID.");
  process.exit(1);
}

for (const [name, serviceId] of serviceIds) {
  const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    body: JSON.stringify({ clearCache: "do_not_clear" }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const body = await response.text();
  if (!response.ok) {
    console.error(`Render deploy failed for ${name} (${serviceId}): ${response.status} ${body}`);
    process.exit(1);
  }

  console.log(`Render deploy started for ${name} (${serviceId}): ${body}`);
}
