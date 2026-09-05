import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Protected, LoginPage, RegisterPage, Forbidden, homeFor } from '../features/auth/pages';
import { Shell } from './shell';
import { useAuth } from './runtime';
import { InstructorHome, ScenariosPage } from '../features/instructor/home';
import { StudentHome, SessionsPage } from '../features/student/home';
import { SimulationWorkspace } from '../features/simulation/workspace';
function HomeRedirect() { return <Navigate to={homeFor(useAuth().user)} replace/>; }
function RouteFocus() { const { pathname } = useLocation(); useEffect(() => { document.getElementById('main')?.focus(); window.scrollTo?.(0, 0); }, [pathname]); return null; }
export function AppRoutes() { return <><RouteFocus/><Routes><Route path="/auth/register" element={<RegisterPage/>}/><Route path="/auth/*" element={<LoginPage/>}/><Route element={<Protected/>}><Route path="/forbidden" element={<Forbidden/>}/><Route element={<Shell/>}><Route index element={<HomeRedirect/>}/><Route element={<Protected role="Instructor"/>}><Route path="/instructor" element={<InstructorHome/>}/><Route path="/instructor/scenarios" element={<ScenariosPage/>}/><Route path="/instructor/sessions" element={<SessionsPage/>}/></Route><Route element={<Protected role="Student"/>}><Route path="/student" element={<StudentHome/>}/><Route path="/student/sessions" element={<SessionsPage/>}/></Route><Route path="/simulation/:sessionId" element={<SimulationWorkspace/>}/><Route path="*" element={<section className="state"><h1>Page not found</h1><p>Choose a workspace from the navigation.</p></section>}/></Route></Route></Routes></>; }
