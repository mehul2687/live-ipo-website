async function findCompanyListUrls() {
  const res = await fetch('https://www.moneycontrol.com/markets/indian-indices/', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const matches = html.match(/\/markets\/indian-indices\/top-[^"'\s<>]+/gi) || [];
  const unique = Array.from(new Set(matches));
  console.log('Total company list URLs found:', unique.length);
  unique.forEach((u, i) => console.log(i + 1, u));
}

findCompanyListUrls();
