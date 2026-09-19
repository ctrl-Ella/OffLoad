"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronLeft, Clock3, House, SquareCheck, TriangleAlert } from "lucide-react";

const items = [
  { title: "Product meeting", detail: "Thu 18:00 – 19:00", type: "Event" },
  { title: "Leo's football", detail: "Thu 18:30 pick-up", type: "Event" },
  { title: "Order groceries", detail: "Before Thursday", type: "Task" },
  { title: "Send report to Laura", detail: "Due Friday", type: "Task" },
  { title: "Two places at 18:30", detail: "Meeting and pick-up overlap", type: "Conflict" },
];
const tabs = [
  { name: "Week", icon: House },
  { name: "Offload", icon: null },
  { name: "Plan", icon: CalendarDays },
  { name: "Time", icon: Clock3 },
];

export default function Inicio() {
  const [activeTab, setActiveTab] = useState("Offload");
  const [reviewing, setReviewing] = useState(false);
  const isOverview = activeTab === "Offload";
  const visibleItems = activeTab === "Time" ? items.filter((item) => item.type !== "Task") : items;
  function navigate(tab: string) { setActiveTab(tab); setReviewing(false); }

  return (
    <main className="offload-app" lang="en">
      <div className="screen-content">
        <header className="screen-toolbar">
          <button className="back-button" aria-label={isOverview ? "Go to week" : "Back to offload"} onClick={() => navigate(isOverview ? "Week" : "Offload")}>
            <ChevronLeft size={25} strokeWidth={1.8} aria-hidden="true" />
          </button>
          {!isOverview && <span className="toolbar-label">{reviewing ? "Review your plan" : activeTab}</span>}
        </header>
        <section className="summary" aria-labelledby="screen-title">
          <div className="success-orb" aria-hidden="true">
            {isOverview ? <Check size={34} strokeWidth={2.8} /> : <CalendarDays size={32} strokeWidth={1.8} />}
          </div>
          <h1 id="screen-title">{isOverview ? "I've got it." : activeTab === "Time" ? "Make room." : activeTab === "Week" ? "Your week." : "Here's the plan."}</h1>
          <p>{isOverview ? "5 things, sorted." : activeTab === "Time" ? "One overlap to work through." : "Everything in one place."}</p>
        </section>
        <section className="organized-items" aria-label="Your organized items">
          <ul className="item-list">
            {visibleItems.map((item) => {
              const Icon = item.type === "Event" ? CalendarDays : item.type === "Task" ? SquareCheck : TriangleAlert;
              return (
                <li key={item.title} className={`item-card${item.type === "Conflict" ? " conflict-card" : ""}`}>
                  <span className="item-icon"><Icon size={23} strokeWidth={2} aria-hidden="true" /></span>
                  <div className="item-copy"><h2>{item.title}</h2><p>{item.detail}</p></div>
                  <span className="item-type">{item.type}</span>
                </li>
              );
            })}
          </ul>
          {(reviewing || activeTab === "Time") && (
            <aside className="review-note" aria-label="Schedule conflict">
              <h2>A little breathing room.</h2>
              <p>Your product meeting ends at 19:00, but Leo needs picking up at 18:30. Arrange another pick-up or move the meeting before confirming your plan.</p>
            </aside>
          )}
        </section>
        <div className="primary-action">
          <button className="review-button" onClick={() => { if (reviewing) navigate("Offload"); else { setActiveTab("Plan"); setReviewing(true); } }}>
            {reviewing ? "Back to overview" : "Review the plan"}
          </button>
        </div>
      </div>
      <nav className="bottom-navigation" aria-label="Main navigation">
        {tabs.map(({ name, icon: Icon }) => (
          <button key={name} className={`nav-item${activeTab === name ? " active" : ""}`} aria-current={activeTab === name ? "page" : undefined} onClick={() => navigate(name)}>
            <span className="nav-icon">{Icon ? <Icon size={25} strokeWidth={1.8} aria-hidden="true" /> : <span className="nav-orb" />}</span>
            <span>{name}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
