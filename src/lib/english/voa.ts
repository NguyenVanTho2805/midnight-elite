// Lấy bài VOA Learning English (public domain — https://learningenglish.voanews.com/p/6861.html).
// Chỉ cho phép tên miền của VOA (chặn SSRF). Không chép ảnh / bài của hãng tin (AP, Reuters, AFP) — chỉ lấy chữ bài VOA.

const ALLOWED_HOSTS = new Set(["learningenglish.voanews.com", "www.voanews.com", "voanews.com"]);

export function isVoaUrl(u: string): boolean {
  try { const x = new URL(u); return x.protocol === "https:" && ALLOWED_HOSTS.has(x.hostname); } catch { return false; }
}

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#039;|&rsquo;|&lsquo;/g, "'")
  .replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export interface FeedItem { title: string; link: string; pubDate: string | null }

export function parseRss(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const block = m[0];
    const title = decode(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const link = decode(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? null;
    if (title && isVoaUrl(link)) items.push({ title, link, pubDate });
  }
  return items;
}

/** Trích chữ bài viết từ HTML trang bài VOA: các đoạn <p> trong khối nội dung "wsw"; audio = file .mp3 đầu tiên. */
export function parseArticle(html: string): { title: string; body: string; audioUrl: string | null } {
  const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const start = html.search(/<div[^>]+class="[^"]*\bwsw\b[^"]*"/i);
  let region = start >= 0 ? html.slice(start) : html;
  const stop = region.search(/<div[^>]+class="[^"]*\b(?:c-author|media-block|comments|share--box|wsw__embed--end)\b/i);
  if (stop > 0) region = region.slice(0, stop);
  region = region.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<figure[\s\S]*?<\/figure>/gi, "");
  const paras = [...region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => decode(m[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter(p => p.length > 1)
    // bỏ dòng ký tên / phần "Words in This Story" (danh sách từ) ở cuối bài
    ;
  const cut = paras.findIndex(p => /^(_{3,}|words in this story|quiz\b|i'm\s+[A-Z].*\.$)/i.test(p));
  const body = (cut > 2 ? paras.slice(0, cut) : paras).join("\n\n");
  const audioUrl = html.match(/https:\/\/[^"'\s]+?\.mp3/i)?.[0] ?? null;
  return { title, body, audioUrl };
}

async function get(url: string): Promise<string> {
  if (!isVoaUrl(url)) throw new Error("Chỉ nhận đường dẫn của VOA Learning English");
  const res = await fetch(url, { headers: { "user-agent": "KiN-English/1.0 (+self-study)" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`VOA trả về ${res.status}`);
  if (!isVoaUrl(res.url)) throw new Error("Đường dẫn chuyển hướng ra ngoài VOA");
  return res.text();
}

export async function fetchFeed(url: string): Promise<FeedItem[]> { return parseRss(await get(url)); }
export async function fetchArticle(url: string) { return parseArticle(await get(url)); }
