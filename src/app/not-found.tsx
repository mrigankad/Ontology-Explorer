import Link from "next/link";

export default function NotFound() {
  return (
    <main className="ox-boot">
      <p>This page doesn’t exist.</p>
      <Link href="/">Open the ontology explorer</Link>
    </main>
  );
}
