import React, { useState } from 'react';
import '../styles/sidebar.css';

interface SidebarProps {
  user: any;
  onLogout: () => void;
  onProfileClick: () => void;
  activeItem?: string;
  onItemClick: (item: string) => void;
}

const DEFAULT_PICTURE = 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png';

const Sidebar: React.FC<SidebarProps> = ({
  user,
  onLogout,
  onProfileClick,
  activeItem = 'connect',
  onItemClick
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    { id: 'connect', label: 'Connect', icon: 'ph-plugs' },
    { id: 'chat', label: 'Chat', icon: 'ph-chat-circle' },
    { id: 'music', label: 'Music', icon: 'ph-music-notes' },
    { id: 'pet', label: 'Pet', icon: 'ph-paw-print' },
    { id: 'settings', label: 'Settings', icon: 'ph-gear' },
  ];

  return (
    <aside className={`primary-sidebar ${isExpanded ? 'expanded' : ''}`}>
      <div className="sidebar-header-area">
        {/* Logo hidden for now as per user request */}
        <div className="sidebar-logo" style={{ display: 'none' }}>
          <i className="ph-fill ph-crown"></i>
        </div>
        <button className="sidebar-toggle-btn toggle-btn" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Minimize" : "Expand"}>
          <div className="item-kitty"></div>
          <i className={`ph-bold ${isExpanded ? 'ph-duotone ph-arrow-fat-left' : 'ph-list'}`}></i>
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${item.id}-btn ${activeItem === item.id ? 'active' : ''}`}
            onClick={() => onItemClick(item.id)}
            title={item.label}
          >
            <div className="item-kitty"></div>
            <i className={`ph ${item.icon}`}></i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user user-btn" onClick={onProfileClick}>
          <div className="item-kitty"></div>
          <img
            src={(user?.picture && user.picture !== DEFAULT_PICTURE) ? user.picture : '/profile_icon.jpeg'}
            alt={user?.name || 'Guest'}
            className="sidebar-user-avatar"
          />
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || 'Guest'}</span>
            <span className="sidebar-user-status">Online</span>
          </div>
        </div>

        <button className="sidebar-item logout-item logout-btn" onClick={onLogout} title="Logout">
          <div className="item-kitty"></div>
          <i className="ph ph-sign-out"></i>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
