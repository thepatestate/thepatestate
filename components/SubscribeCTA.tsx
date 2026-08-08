import { SUBSCRIBE_URL } from "@/lib/youtube";

export default function SubscribeCTA({ label = "Subscribe on YouTube" }: { label?: string }) {
  return (
    <a className="btn gold" href={SUBSCRIBE_URL} target="_blank" rel="noopener">{label}</a>
  );
}
