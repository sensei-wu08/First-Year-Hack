import { Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import GroupLayout from './components/GroupLayout'
import RequireProfile from './components/RequireProfile'
import Battle from './pages/Battle'
import Chat from './pages/Chat'
import CreateGroup from './pages/CreateGroup'
import GroupWrapped from './pages/GroupWrapped'
import Home from './pages/Home'
import Join from './pages/Join'
import League from './pages/League'
import Me from './pages/Me'
import MockNotify from './pages/MockNotify'
import NewBattle from './pages/NewBattle'
import Onboard from './pages/Onboard'
import PersonalWrapped from './pages/PersonalWrapped'
import Settings from './pages/Settings'
import ShareVote from './pages/ShareVote'
import Today from './pages/Today'

// Full route table. Workstreams never edit this file: they replace the body of their own page file.
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/onboard" element={<Onboard />} />
        <Route path="/new" element={<RequireProfile><CreateGroup /></RequireProfile>} />
        <Route path="/j/:code" element={<Join />} />
        <Route path="/me" element={<RequireProfile><Me /></RequireProfile>} />
        <Route path="/me/wrapped/:month" element={<RequireProfile><PersonalWrapped /></RequireProfile>} />
        <Route path="/b/:battleId" element={<RequireProfile><Battle /></RequireProfile>} />
        <Route path="/v/:shareCode" element={<ShareVote />} />
        <Route path="/demo/notify" element={<MockNotify />} />
        <Route path="/g/:groupId" element={<RequireProfile><GroupLayout /></RequireProfile>}>
          <Route index element={<Today />} />
          <Route path="table" element={<League />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<Settings />} />
          <Route path="new-battle" element={<NewBattle />} />
          <Route path="wrapped/:seasonId" element={<GroupWrapped />} />
        </Route>
      </Route>
    </Routes>
  )
}
