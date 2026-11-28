import { useQuery } from '@tanstack/react-query';
import { useAuth,useRuntime } from '../../app/runtime';
import { ErrorState,LoadingState } from '../../components/states';
import { marketAuthoring } from '../scenarios/service';
import type { CompetitiveMarketScenarioContent } from '../../types/competitive-market';
import { bindingEqual,worldTemplates } from './laboratory-service';
import { D3_TEXT } from './PairedQuotationWorkspace';

export function WorldBindingEditor({value,onChange}:{value:CompetitiveMarketScenarioContent;onChange:(value:CompetitiveMarketScenarioContent)=>void}){
  const {api}=useRuntime();const {user}=useAuth();
  const catalog=useQuery({queryKey:['user',user!.id,'world-templates','Economics.CompetitiveMarket','1.0.0'],queryFn:({signal})=>worldTemplates(api,signal)});
  const templates=useQuery({queryKey:['user',user!.id,'market-authoring-templates'],queryFn:({signal})=>marketAuthoring(api).templates(signal)});
  const available=catalog.data??[];const current=available.findIndex(t=>bindingEqual(t.binding,value.world));
  const lab=templates.data?.find(t=>t.content.pairedQuotationLaboratory===true);
  const labV2=templates.data?.find(t=>t.content.pairedQuotationLaboratory===true&&t.content.gameplayPolicyVersion===2);
  const compatibleLab=!!lab&&available.some(t=>bindingEqual(t.binding,lab.content.world));
  return <section className="card" aria-labelledby="world-binding-title"><h3 id="world-binding-title">Compatible world and academic experience</h3>
    <p>World binding is optional and explicitly selected. New publications preserve these settings; existing frozen sessions are unchanged.</p>
    {catalog.isPending?<LoadingState label="Discovering compatible worlds"/>:catalog.isError?<ErrorState error={catalog.error} retry={()=>void catalog.refetch()}/>:<>
      <div className="form-field"><label htmlFor="market-world-binding">World template</label><select id="market-world-binding" value={!value.world?'none':current<0?'unknown':String(current)} onChange={event=>{if(event.target.value==='none')onChange({...value,world:null,pairedQuotationLaboratory:false});else {const template=available[Number(event.target.value)];if(template)onChange({...value,world:{...template.binding}});}}}>
        <option value="none">No world binding (existing scenario behavior)</option>{value.world&&current<0&&<option value="unknown" disabled>Current binding is not in the compatible catalog</option>}{available.map((template,index)=><option key={template.binding.templateHash} value={String(index)}>{template.name}</option>)}</select></div>
      {!available.length&&<p>No compatible world template is installed for this model/version.</p>}
      {value.world&&<dl className="session-facts"><div><dt>Template</dt><dd>{value.world.templateId} {value.world.templateVersion}</dd></div><div><dt>Projector</dt><dd>{value.world.projectorId} {value.world.projectorVersion}</dd></div><div><dt>Compatibility</dt><dd>{current>=0?'Listed for CompetitiveMarket 1.0.0; publication still validates all scenario settings.':'Not verified. Select a compatible binding or remove this binding before publication.'}</dd></div></dl>}
      <p>{value.pairedQuotationLaboratory?'Paired Quotation Laboratory is explicitly enabled.':value.world?'World presentation is selected; this alone does not opt the scenario into laboratory gameplay.':'Unbound scenarios remain supported; Honeyville exploration does not fabricate economic outcomes.'}</p>
    </>}
    {templates.isError&&<ErrorState error={templates.error} retry={()=>void templates.refetch()}/>}
    {lab&&<details><summary>Review backend-provided laboratory template</summary><p>{lab.name}</p><p>{lab.content.briefing}</p><ul>{lab.content.learningObjectives.map((objective,i)=><li key={i}>{objective}</li>)}</ul><p>Applying this template replaces the draft content, including market configuration, roles, objectives and teaching prompts. The scenario name is retained. Save and validate afterward.</p>
      <button type="button" disabled={!compatibleLab||catalog.isFetching} onClick={()=>onChange(structuredClone(lab.content))}>Apply backend laboratory template</button></details>}
    {value.pairedQuotationLaboratory&&<div className="form-field"><label htmlFor="gameplay-policy-version">Laboratory gameplay policy</label><select id="gameplay-policy-version" value={value.gameplayPolicyVersion??1} onChange={event=>{if(event.target.value==='1')onChange({...value,gameplayPolicyVersion:1});else if(labV2)onChange(structuredClone(labV2.content));}}><option value="1">Policy v1 · existing native quotation rules</option>{labV2&&<option value="2">Policy v2 · designated one-unit confirmations</option>}</select><p className="field-help">Policy v2 is opt-in for new publications. It designates one buyer and seller per team market, fixes each quotation to one unit, seals one confirmation per role and period, and permits correction only through an instructor reopening. Applying its backend template replaces the draft content.</p></div>}
    {!lab&&!templates.isPending&&!templates.isError&&<p>The installed authoring service has no paired laboratory template; no gameplay binding can be inferred.</p>}
    {value.gameplayPolicyVersion===2?<p className="notice">Policy v2 makes quotation slots single-confirmation and one unit; student amendments are unavailable. Instructors may reopen an unexecuted slot with a recorded reason, after which the student must confirm again.</p>:<p className="notice">{D3_TEXT} Publication validation is not approval for a full classroom pilot.</p>}
    {value.pairedQuotationLaboratory&&<><p>The laboratory requires one period, BUYER and SELLER roles, supported quotation actions, one configured synthetic unit per side, positive slopes, and no policies or shocks. Native submitted quantities still range from 1 to 1000.</p><h4>Role-private information for new publications</h4><p>Only an enabled own-side capability exposes the configured synthetic schedule. This is not a personal endowment and does not reveal counterpart information. Existing frozen grants are unchanged.</p><div className="checks">{value.roles.map(role=><label className="check-field" key={role.code}><input type="checkbox" checked={role.seePrivateInformation} onChange={event=>onChange({...value,roles:value.roles.map(r=>r.code===role.code?{...r,seePrivateInformation:event.target.checked}:r)})}/><span>{role.code}: show own-side schedule</span></label>)}</div></>}
  </section>;
}
