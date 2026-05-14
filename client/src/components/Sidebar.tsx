import React, { useState } from 'react';
import '../styles/sidebar.css';

interface SidebarProps {
  user: any;
  onLogout: () => void;
  onProfileClick: () => void;
  activeItem?: string;
  onItemClick: (item: string) => void;
}

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
          <i className={`ph-bold ${isExpanded ? 'ph-caret-left' : 'ph-list'}`}></i>
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
        <div className="sidebar-user" onClick={onProfileClick}>
          {user?.picture ? (
            <img src={user.picture} alt={user.name} className="sidebar-user-avatar" />
          ) : (
            <div className="sidebar-user-avatar" style={{ 
              background: '#a88dc0', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              {user?.name?.[0] || '?'}
            </div>
          )}
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
