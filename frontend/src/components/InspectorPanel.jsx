import React from 'react';
import ContextualDetailPanel from './ContextualDetailPanel';

/**
 * InspectorPanel component for displaying cloud-native metadata and node properties
 * Aliased to ContextualDetailPanel for full backwards compatibility
 */
export default function InspectorPanel(props) {
  return <ContextualDetailPanel {...props} />;
}
