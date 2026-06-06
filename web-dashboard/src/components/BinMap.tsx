import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import { getBinTypeColorHex, getBinTypeLabel as getBinTypeLabelUtil } from '../utils/binUtils';
import { formatDateForMap } from '../utils/dateUtils';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface BinLocation {
  _id: string;
  binId: string;
  binType: string;
  currentLevel: number;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  status: string;
  isOverflowing: boolean;
  lastEmptied?: string;
}

interface BinMapProps {
  bins: BinLocation[];
  center?: LatLngTuple;
  zoom?: number;
  onBinClick?: (bin: BinLocation) => void;
}

// Enhanced custom marker icons with modern design and better visualization
const createCustomIcon = (fillLevel: number, isOverflowing: boolean) => {
  // Color scheme based on fill level
  let primaryColor = '#22c55e'; // green-500
  let secondaryColor = '#16a34a'; // green-600
  let gradientStart = '#4ade80'; // green-400
  let gradientEnd = '#22c55e'; // green-500
  let textColor = '#ffffff';
  let glowColor = 'rgba(34, 197, 94, 0.4)'; // green with opacity

  if (isOverflowing || fillLevel >= 90) {
    primaryColor = '#ef4444'; // red-500
    secondaryColor = '#dc2626'; // red-600
    gradientStart = '#f87171'; // red-400
    gradientEnd = '#ef4444'; // red-500
    glowColor = 'rgba(239, 68, 68, 0.5)';
  } else if (fillLevel >= 70) {
    primaryColor = '#f59e0b'; // amber-500
    secondaryColor = '#d97706'; // amber-600
    gradientStart = '#fbbf24'; // amber-400
    gradientEnd = '#f59e0b'; // amber-500
    glowColor = 'rgba(245, 158, 11, 0.4)';
  }

  const isHigh = fillLevel >= 70;
  const isCritical = fillLevel >= 90 || isOverflowing;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (fillLevel / 100) * circumference;

  // Generate unique IDs for each marker to avoid conflicts
  const markerId = `marker-${Math.random().toString(36).substr(2, 9)}`;

  const svgIcon = `
    <svg width="64" height="72" viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Shadow filter -->
        <filter id="shadow-${markerId}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="3" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.4"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <!-- Glow filter for critical bins -->
        ${isCritical ? `
        <filter id="glow-${markerId}" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        ` : ''}
        
        <!-- Gradient for pin -->
        <linearGradient id="pinGradient-${markerId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
        </linearGradient>
        
        <!-- Gradient for circle background -->
        <radialGradient id="circleGradient-${markerId}" cx="50%" cy="50%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0.1" />
        </radialGradient>
      </defs>

      <!-- Drop shadow -->
      <ellipse cx="32" cy="68" rx="12" ry="4" fill="#000" opacity="0.25"/>

      <!-- Main pin body with gradient -->
      <path d="M32 4C18.745 4 8 14.745 8 28c0 14.837 24 36 24 36s24-21.163 24-36C56 14.745 45.255 4 32 4z"
            fill="url(#pinGradient-${markerId})"
            stroke="${secondaryColor}"
            stroke-width="2.5"
            filter="${isCritical ? `url(#glow-${markerId})` : `url(#shadow-${markerId})`}"
            style="filter: ${isCritical ? `drop-shadow(0 0 8px ${glowColor})` : 'none'};"/>

      <!-- Outer ring for fill level (background) with better visibility -->
      <circle cx="32" cy="26" r="${radius + 2}" 
              fill="none" 
              stroke="rgba(255,255,255,0.4)" 
              stroke-width="4.5"
              opacity="0.7"/>

      <!-- Fill level progress ring with enhanced visibility -->
      <circle cx="32" cy="26" 
              r="${radius}" 
              fill="none" 
              stroke="white" 
              stroke-width="4.5"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"
              stroke-linecap="round"
              transform="rotate(-90 32 26)"
              style="filter: drop-shadow(0 0 3px rgba(255,255,255,0.9)), drop-shadow(0 0 6px ${glowColor});"/>

      <!-- Solid white background circle for maximum contrast -->
      <circle cx="32" cy="26" r="14" 
              fill="white"
              stroke="${primaryColor}"
              stroke-width="3"
              opacity="0.98"/>

      <!-- Inner white circle for text area -->
      <circle cx="32" cy="26" r="11" 
              fill="white"
              opacity="1"/>

      <!-- Text outline/stroke layer for maximum readability -->
      <text x="32" y="28.5"
            font-family="'Segoe UI', 'Roboto', 'Arial', sans-serif"
            font-size="16"
            font-weight="900"
            fill="none"
            stroke="white"
            stroke-width="2.5"
            stroke-linejoin="round"
            text-anchor="middle"
            dominant-baseline="middle"
            opacity="1">
        ${Math.round(fillLevel)}%
      </text>
      
      <!-- Main fill percentage text with strong contrast -->
      <text x="32" y="28.5"
            font-family="'Segoe UI', 'Roboto', 'Arial', sans-serif"
            font-size="16"
            font-weight="900"
            fill="${primaryColor}"
            text-anchor="middle"
            dominant-baseline="middle"
            style="letter-spacing: -0.2px; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.2));">
        ${Math.round(fillLevel)}%
      </text>

      <!-- Status indicator dot -->
      <circle cx="32" cy="38" r="3" 
              fill="${primaryColor}"
              stroke="white"
              stroke-width="1.5"
              style="filter: drop-shadow(0 0 2px ${primaryColor});"/>

      ${isCritical ? `
      <!-- Pulsing warning ring for critical bins -->
      <circle cx="32" cy="26" r="${radius + 6}" 
              fill="none" 
              stroke="${primaryColor}" 
              stroke-width="2.5" 
              opacity="0.6">
        <animate attributeName="r" values="${radius + 6};${radius + 10};${radius + 6}" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="32" cy="26" r="${radius + 4}" 
              fill="none" 
              stroke="${primaryColor}" 
              stroke-width="2" 
              opacity="0.4">
        <animate attributeName="r" values="${radius + 4};${radius + 8};${radius + 4}" dur="1.5s" repeatCount="indefinite" begin="0.3s"/>
        <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" begin="0.3s"/>
      </circle>
      ` : isHigh ? `
      <!-- Subtle pulse for warning bins -->
      <circle cx="32" cy="26" r="${radius + 4}" 
              fill="none" 
              stroke="${primaryColor}" 
              stroke-width="2" 
              opacity="0.3">
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
      ` : ''}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker-enhanced',
    iconSize: [64, 72],
    iconAnchor: [32, 72],
    popupAnchor: [0, -72],
  });
};

// Component to fit map bounds to show all bins
const FitBounds: React.FC<{ bins: BinLocation[] }> = ({ bins }) => {
  const map = useMap();

  useEffect(() => {
    if (bins.length === 0) return;

    const bounds = bins.map((bin) => [
      bin.location.latitude,
      bin.location.longitude,
    ] as LatLngTuple);

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bins, map]);

  return null;
};

export const BinMap: React.FC<BinMapProps> = ({
  bins,
  center = [6.9271, 79.8612], // Default: Colombo, Sri Lanka
  zoom = 13,
  onBinClick,
}) => {
  // Use shared utilities
  const getBinTypeLabel = getBinTypeLabelUtil;
  const getBinTypeColor = getBinTypeColorHex;
  const formatDate = formatDateForMap;

  const getStatusBadge = (bin: BinLocation) => {
    if (bin.isOverflowing || bin.currentLevel >= 90) {
      return '<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background-color: #dc2626; border-radius: 50%; display: inline-block;"></span>Critical</span>';
    } else if (bin.currentLevel >= 70) {
      return '<span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background-color: #d97706; border-radius: 50%; display: inline-block;"></span>Warning</span>';
    } else {
      return '<span style="background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background-color: #16a34a; border-radius: 50%; display: inline-block;"></span>Normal</span>';
    }
  };

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-xl border border-gray-200 relative">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        scrollWheelZoom={true}
      >
        {/* Professional tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {bins.map((bin) => (
          <Marker
            key={bin._id}
            position={[bin.location.latitude, bin.location.longitude]}
            icon={createCustomIcon(bin.currentLevel, bin.isOverflowing)}
            eventHandlers={{
              click: () => {
                if (onBinClick) {
                  onBinClick(bin);
                }
              },
            }}
          >
            <Popup closeButton={true} className="custom-popup">
              <div style={{ minWidth: '240px', padding: '12px' }}>
                {/* Header */}
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '2px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                      {bin.binId}
                    </h3>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: getBinTypeColor(bin.binType),
                      boxShadow: `0 0 0 3px ${getBinTypeColor(bin.binType)}33`
                    }} />
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, fontWeight: '500' }}>
                    {getBinTypeLabel(bin.binType)}
                  </p>
                </div>

                {/* Fill Level Progress */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Fill Level</span>
                    <span style={{ fontSize: '1rem', fontWeight: '700', color: bin.currentLevel >= 90 ? '#dc2626' : bin.currentLevel >= 70 ? '#d97706' : '#16a34a' }}>
                      {bin.currentLevel}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '9999px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${bin.currentLevel}%`,
                      height: '100%',
                      backgroundColor: bin.currentLevel >= 90 ? '#ef4444' : bin.currentLevel >= 70 ? '#f59e0b' : '#22c55e',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease',
                      boxShadow: bin.currentLevel >= 90 ? '0 0 8px rgba(239, 68, 68, 0.5)' : 'none'
                    }} />
                  </div>
                </div>

                {/* Status Badge */}
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Status:</span>
                  <div dangerouslySetInnerHTML={{ __html: getStatusBadge(bin) }} />
                </div>

                {/* Last Emptied */}
                <div style={{ marginBottom: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Last Emptied:</span>
                    <span style={{ fontSize: '0.75rem', color: '#111827', fontWeight: '600' }}>{formatDate(bin.lastEmptied)}</span>
                  </div>
                </div>

                {/* Address */}
                {bin.location.address && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'start', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>📍</span>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                        {bin.location.address}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBounds bins={bins} />
      </MapContainer>
    </div>
  );
};
