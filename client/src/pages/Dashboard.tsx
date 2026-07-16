import React from 'react'
import AnimatedCore from '../components/AnimatedCore'
import ChatPanel from '../components/ChatPanel'

export default function Dashboard() {
  return (
    <div className="p-8 grid grid-cols-12 gap-6">
      <div className="col-span-4">
        <div className="bg-surface rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <ul className="space-y-2 text-sm">
            <li>CPU: --%</li>
            <li>RAM: --%</li>
            <li>Battery: --%</li>
          </ul>
        </div>
      </div>
      <div className="col-span-4 flex items-center justify-center">
        <AnimatedCore />
      </div>
      <div className="col-span-4">
        <ChatPanel />
      </div>
    </div>
  )
}
