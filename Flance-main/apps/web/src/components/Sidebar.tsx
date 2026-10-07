import React, { useState } from "react";

interface Conversation {
  id: string;
  title: string;
}

const Sidebar: React.FC<{ conversations: Conversation[] }> = ({ conversations }) => {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <aside
      style={{
        width: "250px",
        backgroundColor: "transparent",
       
        padding: "1rem",
        height: "86.5vh",
      }}
    >
      <h2 style={{ marginBottom: "1rem" }}>Conversas</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {conversations.map((conv) => (
          <li
            key={conv.id}
            onClick={() => setSelected(conv.id)}
            style={{
              padding: "0.5rem",
              marginBottom: "0.5rem",
              cursor: "pointer",
              borderRadius: "8px",
              backgroundColor: selected === conv.id ? "#ff5c5c" : "transparent",
              color: selected === conv.id ? "white" : "black",
              transition: "background-color 0.3s",
            }}
          >
            {conv.title}
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;
