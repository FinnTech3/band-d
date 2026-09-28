// The six tools, in the order they were made. The same file sits in each of
// the six repositories, so every site can point to the other five.

export const PORTFOLIO = "https://finn-lakin-portfolio.netlify.app/";

export interface Work {
  no: number;
  slug: string;
  topic: string;
  title: string;
  url: string;
}

export const SERIES: Work[] = [
  { no: 1, slug: "band-d", topic: "Council tax", title: "England, priced in 1991" },
  { no: 2, slug: "degree-value", topic: "Student loans", title: "When your loan ends" },
  { no: 3, slug: "pension-pot", topic: "Pensions", title: "What a retirement costs" },
  { no: 4, slug: "trolley-watch", topic: "Food prices", title: "Whose food inflation?" },
  { no: 5, slug: "deposit-gap", topic: "Deposits", title: "How long a deposit takes" },
  { no: 6, slug: "brexit-baseline", topic: "Brexit and trade", title: "Pick your baseline" },
].map((w) => ({ ...w, url: `https://finntech3.github.io/${w.slug}/` }));
