import type { Metadata } from "next";
import SportsMapApp from "./SportsMapApp";

export const metadata: Metadata = {
  title: "いまスポ | いまの条件に合う運動を、江東区で",
  description:
    "時間・予算・人数・気分から、江東区でできる運動を3つ提案。給水スポットや涼み処も一緒に探せるスポーツマップです。",
};

export default function Home() {
  return <SportsMapApp />;
}
