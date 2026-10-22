import { useEffect, useState } from "react";
import { useServices } from "../servicesContext.ts";
import { LoadError, Loading, Table } from "../ui/index.ts";
import type {
  AreaEngagement,
  DailyEngagement,
} from "./engagementRepository.ts";
import styles from "./UserAnalyticsPage.module.css";

const DAYS = 14;
const date = (iso: string | null) => (iso ? iso.slice(0, 10) : "–");
const count = (n: number | null) => (n === null || n === 0 ? "–" : String(n));

/** How many people use each reviewing area, admins' own activity left out (maintainer, 22 Oct 2026). */
export function UserAnalyticsPage() {
  const { engagement } = useServices();
  const [data, setData] = useState<{
    areas: AreaEngagement[];
    daily: DailyEngagement[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([engagement.listAreas(), engagement.listDaily(DAYS)]).then(
      ([areas, daily]) => live && setData({ areas, daily }),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [engagement, attempt]);

  if (failed)
    return (
      <LoadError
        what="user analytics"
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  if (!data) return <Loading label="Loading user analytics" />;

  return (
    <section className={styles.page}>
      <h1>User analytics</h1>
      <p className={styles.intro}>
        Admins are left out. Counts each item once, on the day it was last
        changed; Quick review vs card page isn't recorded.
      </p>
      <Table<AreaEngagement>
        caption="Engagement by area"
        rows={data.areas}
        rowKey={(r) => r.area}
        columns={[
          { key: "area", header: "Area" },
          { key: "people", header: "People", render: (r) => count(r.people) },
          { key: "items", header: "Items", render: (r) => count(r.items) },
          {
            key: "per",
            header: "Items per person",
            render: (r) => (r.itemsPerPerson === null ? "–" : r.itemsPerPerson),
          },
          {
            key: "p7",
            header: "People, last 7 days",
            render: (r) => count(r.peopleLast7d),
          },
          {
            key: "i7",
            header: "Items, last 7 days",
            render: (r) => count(r.itemsLast7d),
          },
          { key: "first", header: "First", render: (r) => date(r.first) },
          { key: "latest", header: "Latest", render: (r) => date(r.latest) },
        ]}
      />
      <Table<DailyEngagement>
        caption={`Engagement by day, last ${DAYS} days`}
        rows={data.daily}
        rowKey={(r) => `${r.day} ${r.area}`}
        empty="Nothing in this period."
        columns={[
          { key: "day", header: "Day" },
          { key: "area", header: "Area" },
          { key: "people", header: "People" },
          { key: "items", header: "Items" },
        ]}
      />
    </section>
  );
}
