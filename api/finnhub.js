// api/finnhub.js
// Vercel Serverless Function — Finnhub API 프록시
// 브라우저에서 /api/finnhub?path=quote?symbol=AAPL 로 호출

export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'path parameter required' });
  }

  // Finnhub 키는 Vercel 환경변수에서 가져옴 (절대 코드에 노출 안 됨)
  const FINNHUB_KEY = process.env.FINNHUB_KEY;
  if (!FINNHUB_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // 허용된 엔드포인트만 통과 (보안)
  const ALLOWED = [
    'quote', 'company-news', 'news', 'forex/rates', 'stock/candle',
  ];
  const endpoint = path.split('?')[0];
  if (!ALLOWED.some(a => endpoint.startsWith(a))) {
    return res.status(403).json({ error: 'endpoint not allowed' });
  }

  try {
    const separator = path.includes('?') ? '&' : '?';
    const url = `https://finnhub.io/api/v1/${path}${separator}token=${FINNHUB_KEY}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'portfolio-dashboard/1.0' },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Finnhub HTTP ${response.status}` });
    }

    const data = await response.json();

    // 캐시 설정 (주가: 30초, 뉴스: 5분)
    const isNews = path.includes('news');
    const cacheTime = isNews ? 300 : 30;
    res.setHeader('Cache-Control', `public, s-maxage=${cacheTime}, stale-while-revalidate=60`);

    return res.status(200).json(data);
  } catch (error) {
    console.error('Finnhub proxy error:', error);
    return res.status(500).json({ error: 'proxy request failed' });
  }
}
