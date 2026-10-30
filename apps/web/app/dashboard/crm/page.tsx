'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../src/components/layout/DashboardLayout';
import { ApiService } from '../../../src/services/api';
import { useLanguage } from '../../../src/hooks/use-language';
import { useCompany } from '../../../src/hooks/use-company';
import { useToast } from '../../../src/hooks/use-toast';
import { useConfirm } from '../../../src/hooks/use-confirm';
import { useDebounce } from '../../../src/hooks/use-debounce';
import { DataTable, Column } from '../../../src/components/ui/DataTable';
import { Modal } from '../../../src/components/ui/Modal';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Select } from '../../../src/components/ui/Select';
import { Badge } from '../../../src/components/ui/Badge';
import {
  Plus,
  Kanban,
  CheckSquare,
  Users,
  Phone,
  Mail,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Layers,
} from 'lucide-react';

export default function CRMPage() {
  const { isRtl } = useLanguage();
  const { formatMoney, currencySymbol } = useCompany();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [activeView, setActiveView] = useState<'KANBAN' | 'LEADS' | 'ACTIVITIES'>('KANBAN');
  const [leads, setLeads] = useState<any[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  // Modals
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [submittingOpp, setSubmittingOpp] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [submittingAct, setSubmittingAct] = useState(false);

  // Forms
  const [leadForm, setLeadForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    source: '',
    notes: '',
  });

  const [oppForm, setOppForm] = useState({
    pipelineId: '',
    stageId: '',
    leadId: '',
    title: '',
    expectedValue: 10000,
    closeDate: '',
    notes: '',
  });

  const [activityForm, setActivityForm] = useState({
    type: 'CALL',
    subject: '',
    description: '',
    leadId: '',
    opportunityId: '',
    dueDate: new Date().toISOString().slice(0, 16),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [lds, pls, acts] = await Promise.all([
        ApiService.listLeads(undefined, debouncedSearch || undefined),
        ApiService.listPipelines(),
        ApiService.listActivities(),
      ]);
      setLeads(lds || []);
      setPipelines(pls || []);
      setActivities(acts || []);

      if (pls && pls.length > 0 && pls[0].stages?.length > 0) {
        setOppForm((prev) => ({
          ...prev,
          pipelineId: pls[0].id,
          stageId: prev.stageId || pls[0].stages[0].id,
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load CRM data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [debouncedSearch]);

  const currentPipeline = pipelines[0] || null;
  const stages = currentPipeline?.stages || [];

  // Summary Metrics
  const totalPipelineValue = stages.reduce(
    (acc: number, s: any) =>
      acc +
      (s.opportunities || []).reduce(
        (sum: number, o: any) => sum + Number(o.expectedValue || 0),
        0,
      ),
    0,
  );

  const totalOppsCount = stages.reduce(
    (acc: number, s: any) => acc + (s.opportunities || []).length,
    0,
  );

  // Handlers
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name.trim()) return;

    setSubmittingLead(true);
    try {
      await ApiService.createLead(leadForm);
      toast.success(isRtl ? 'تمت إضافة العميل المحتمل بنجاح' : 'Lead created successfully');
      setShowLeadModal(false);
      setLeadForm({ name: '', companyName: '', phone: '', email: '', source: '', notes: '' });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create lead');
    } finally {
      setSubmittingLead(false);
    }
  };

  const handleConvertLead = async (leadId: string) => {
    try {
      await ApiService.convertLead(leadId);
      toast.success(
        isRtl
          ? 'تم تحويل العميل المحتمل إلى عميل تجاري رسمي بنجاح'
          : 'Lead converted to customer successfully',
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to convert lead');
    }
  };

  const handleDeleteLead = async (lead: any) => {
    const ok = await confirm({
      title: isRtl ? 'حذف العميل المحتمل' : 'Delete Lead',
      message: isRtl ? `هل تريد حذف العميل المحتمل "${lead.name}"؟` : `Delete lead "${lead.name}"?`,
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await ApiService.deleteLead(lead.id);
      toast.success(isRtl ? 'تم حذف العميل المحتمل' : 'Lead deleted');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete lead');
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oppForm.title.trim()) return;

    setSubmittingOpp(true);
    try {
      await ApiService.createOpportunity({
        ...oppForm,
        expectedValue: Number(oppForm.expectedValue),
        closeDate: oppForm.closeDate ? new Date(oppForm.closeDate).toISOString() : undefined,
        leadId: oppForm.leadId || undefined,
      });
      toast.success(isRtl ? 'تمت إضافة الفرصة البيعية بنجاح' : 'Opportunity created');
      setShowOpportunityModal(false);
      setOppForm((prev) => ({ ...prev, title: '', expectedValue: 10000, notes: '' }));
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create opportunity');
    } finally {
      setSubmittingOpp(false);
    }
  };

  const handleMoveStage = async (oppId: string, targetStageId: string) => {
    try {
      await ApiService.updateOpportunityStage(oppId, targetStageId);
      toast.info(isRtl ? 'تم نقل الفرصة إلى المرحلة التالية' : 'Opportunity moved to next stage');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to move opportunity');
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.subject.trim()) return;

    setSubmittingAct(true);
    try {
      await ApiService.createActivity({
        ...activityForm,
        leadId: activityForm.leadId || undefined,
        opportunityId: activityForm.opportunityId || undefined,
      });
      toast.success(isRtl ? 'تمت جدولة النشاط بنجاح' : 'Activity scheduled');
      setShowActivityModal(false);
      setActivityForm({
        type: 'CALL',
        subject: '',
        description: '',
        leadId: '',
        opportunityId: '',
        dueDate: new Date().toISOString().slice(0, 16),
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create activity');
    } finally {
      setSubmittingAct(false);
    }
  };

  const handleToggleActivity = async (activityId: string, currentStatus: boolean) => {
    try {
      await ApiService.toggleActivity(activityId, !currentStatus);
      toast.success(isRtl ? 'تم تحديث حالة النشاط' : 'Activity status updated');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle activity');
    }
  };

  // Leads Columns
  const leadsColumns: Column<any>[] = [
    {
      key: 'name',
      header: isRtl ? 'اسم العميل المحتمل' : 'Lead Name',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{r.name}</p>
          {r.companyName && <p className="text-2xs text-slate-400">{r.companyName}</p>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: isRtl ? 'الهاتف' : 'Phone',
      render: (r) => <span className="font-mono text-slate-500">{r.phone || '—'}</span>,
    },
    {
      key: 'email',
      header: isRtl ? 'البريد' : 'Email',
      render: (r) => <span className="font-mono text-slate-500">{r.email || '—'}</span>,
    },
    {
      key: 'source',
      header: isRtl ? 'المصدر' : 'Source',
      render: (r) => <Badge variant="neutral" size="sm">{r.source || (isRtl ? 'مباشر' : 'Direct')}</Badge>,
    },
    {
      key: 'status',
      header: isRtl ? 'الحالة' : 'Status',
      render: (r) => (
        <Badge variant={r.status === 'WON' ? 'success' : r.status === 'LOST' ? 'danger' : 'info'} size="sm">
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-2xs h-7"
            onClick={() => handleConvertLead(r.id)}
          >
            {isRtl ? 'تحويل لعميل' : 'Convert'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteLead(r)}
            icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
          />
        </div>
      ),
    },
  ];

  // Activities Columns
  const activitiesColumns: Column<any>[] = [
    {
      key: 'type',
      header: isRtl ? 'النوع' : 'Type',
      render: (r) => <Badge variant="default" size="sm">{r.type}</Badge>,
    },
    {
      key: 'subject',
      header: isRtl ? 'موضوع النشاط' : 'Subject',
      render: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{r.subject}</p>
          {r.description && <p className="text-2xs text-slate-400">{r.description}</p>}
        </div>
      ),
    },
    {
      key: 'dueDate',
      header: isRtl ? 'تاريخ الاستحقاق' : 'Due Date',
      render: (r) => (
        <span className="font-mono text-slate-500">
          {new Date(r.dueDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
        </span>
      ),
    },
    {
      key: 'isCompleted',
      header: isRtl ? 'الحالة' : 'Status',
      render: (r) => (
        <Badge variant={r.isCompleted ? 'success' : 'warning'} size="sm">
          {r.isCompleted ? (isRtl ? 'مكتمل' : 'Completed') : isRtl ? 'قيد الانتظار' : 'Pending'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: isRtl ? 'إكمال' : 'Toggle',
      align: 'end',
      render: (r) => (
        <Button
          size="sm"
          variant={r.isCompleted ? 'secondary' : 'success'}
          className="text-2xs h-7"
          onClick={() => handleToggleActivity(r.id, r.isCompleted)}
        >
          {r.isCompleted ? (isRtl ? 'إعادة للانتظار' : 'Mark Pending') : isRtl ? 'تم الإنجاز' : 'Done'}
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isRtl ? 'إدارة علاقات العملاء (CRM)' : 'CRM & Deals Pipeline'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'متابعة مسار الصفقات، تحويل العملاء المحتملين، وإدارة المكالمات والمهام البيعية'
                : 'Track sales deals, lead qualification, pipelines and customer relationship activities'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActivityModal(true)}
              icon={<CheckSquare className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'جدولة نشاط / مهمة' : 'New Task'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowLeadModal(true)}
              icon={<Users className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'عميل محتمل جديد' : 'New Lead'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowOpportunityModal(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'فرصة بيعية جديدة' : 'New Deal'}
            </Button>
          </div>
        </div>

        {/* View Switcher Ribbon */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveView('KANBAN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeView === 'KANBAN'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>{isRtl ? 'لوحة المراحل (Kanban)' : 'Deals Pipeline'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('LEADS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeView === 'LEADS'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isRtl ? 'العملاء المحتملون (Leads)' : 'Leads'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('ACTIVITIES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeView === 'ACTIVITIES'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isRtl ? 'المهام والأنشطة' : 'Activities'}</span>
            </button>
          </div>

          <div className="text-2xs text-slate-500 font-medium">
            <span>{isRtl ? 'قيمة المسار الإجمالية:' : 'Pipeline Value:'} </span>
            <strong className="text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {formatMoney(totalPipelineValue)}
            </strong>
          </div>
        </div>

        {/* View 1: KANBAN Board */}
        {activeView === 'KANBAN' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto min-h-[500px] items-start">
            {stages.map((stage: any, sIdx: number) => {
              const opps = stage.opportunities || [];
              const stageValue = opps.reduce((sum: number, o: any) => sum + Number(o.expectedValue || 0), 0);
              const nextStage = stages[sIdx + 1];

              return (
                <div
                  key={stage.id}
                  className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col gap-2.5 min-h-[400px]"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{stage.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                        {formatMoney(stageValue)}
                      </span>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {opps.length}
                    </Badge>
                  </div>

                  <div className="space-y-2 flex-1">
                    {opps.length === 0 ? (
                      <div className="py-12 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                        {isRtl ? 'لا توجد فرص هنا' : 'No deals'}
                      </div>
                    ) : (
                      opps.map((opp: any) => (
                        <div
                          key={opp.id}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg p-3 shadow-2xs hover:border-sky-300 dark:hover:border-sky-600 transition flex flex-col justify-between"
                        >
                          <div>
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{opp.title}</h5>
                            {opp.lead && <p className="text-2xs text-slate-400 mt-0.5">{opp.lead.name}</p>}
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                            <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                              {formatMoney(opp.expectedValue || 0)}
                            </span>

                            {nextStage && (
                              <button
                                type="button"
                                onClick={() => handleMoveStage(opp.id, nextStage.id)}
                                className="text-[10px] font-bold text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-0.5"
                                title={isRtl ? `نقل إلى "${nextStage.name}"` : `Move to "${nextStage.name}"`}
                              >
                                <span>{isRtl ? 'المرحلة التالية' : 'Next'}</span>
                                {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View 2: LEADS Table */}
        {activeView === 'LEADS' && (
          <DataTable
            columns={leadsColumns}
            data={leads}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchPlaceholder={isRtl ? 'بحث في العملاء المحتملين...' : 'Search leads...'}
            searchValue={search}
            onSearchChange={setSearch}
            emptyTitle={isRtl ? 'لا يوجد عملاء محتملون' : 'No leads found'}
            emptyActionLabel={isRtl ? 'إضافة عميل محتمل' : 'Add Lead'}
            onEmptyAction={() => setShowLeadModal(true)}
          />
        )}

        {/* View 3: ACTIVITIES Table */}
        {activeView === 'ACTIVITIES' && (
          <DataTable
            columns={activitiesColumns}
            data={activities}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle={isRtl ? 'لا توجد أنشطة مجدولة' : 'No activities scheduled'}
            emptyActionLabel={isRtl ? 'جدولة نشاط' : 'Schedule Activity'}
            onEmptyAction={() => setShowActivityModal(true)}
          />
        )}
      </div>

      {/* Create Lead Modal */}
      <Modal
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        title={isRtl ? 'إضافة عميل محتمل جديد' : 'New Lead'}
        maxWidth="md"
      >
        <form onSubmit={handleCreateLead} className="space-y-3.5">
          <Input
            label={isRtl ? 'اسم العميل المحتمل' : 'Lead Name'}
            required
            value={leadForm.name}
            onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
            placeholder={isRtl ? 'خالد المنصور' : 'Khalid Al-Mansour'}
          />

          <Input
            label={isRtl ? 'اسم الشركة / المنشأة' : 'Company Name'}
            value={leadForm.companyName}
            onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label={isRtl ? 'الهاتف' : 'Phone'}
              value={leadForm.phone}
              onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
            />
            <Input
              label={isRtl ? 'البريد الإلكتروني' : 'Email'}
              type="email"
              value={leadForm.email}
              onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
            />
          </div>

          <Select
            label={isRtl ? 'مصدر العميل' : 'Lead Source'}
            value={leadForm.source}
            onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
          >
            <option value="">{isRtl ? 'غير محدد' : 'Not specified'}</option>
            <option value="WEBSITE">{isRtl ? 'الموقع الإلكتروني' : 'Website'}</option>
            <option value="REFERRAL">{isRtl ? 'توصية / ترشيح' : 'Referral'}</option>
            <option value="EXPO">{isRtl ? 'معرض تجاري' : 'Trade Show'}</option>
            <option value="COLD_CALL">{isRtl ? 'اتصال تسويقي' : 'Cold Outreach'}</option>
          </Select>

          <Input
            label={isRtl ? 'ملاحظات' : 'Notes'}
            value={leadForm.notes}
            onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowLeadModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingLead}>
              {isRtl ? 'حفظ العميل المحتمل' : 'Save Lead'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Opportunity Modal */}
      <Modal
        isOpen={showOpportunityModal}
        onClose={() => setShowOpportunityModal(false)}
        title={isRtl ? 'إضافة فرصة بيعية / صفقة جديدة' : 'New Sales Deal'}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateOpportunity} className="space-y-3.5">
          <Input
            label={isRtl ? 'عنوان الصفقة' : 'Deal Title'}
            required
            value={oppForm.title}
            onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })}
            placeholder={isRtl ? 'توريد أجهزة فرع الرياض' : 'Riyadh Branch Equipment Supply'}
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Select
              label={isRtl ? 'المرحلة الأولية' : 'Initial Stage'}
              required
              value={oppForm.stageId}
              onChange={(e) => setOppForm({ ...oppForm, stageId: e.target.value })}
            >
              {stages.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'العميل المحتمل المرتبط' : 'Associated Lead'}
              value={oppForm.leadId}
              onChange={(e) => setOppForm({ ...oppForm, leadId: e.target.value })}
            >
              <option value="">{isRtl ? 'بدون ربط بعميل محتمل' : 'No Lead'}</option>
              {leads.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label={isRtl ? `القيمة المتوقعة (${currencySymbol})` : `Expected Value (${currencySymbol})`}
              type="number"
              required
              value={oppForm.expectedValue}
              onChange={(e) => setOppForm({ ...oppForm, expectedValue: Number(e.target.value) })}
            />

            <Input
              label={isRtl ? 'تاريخ الإغلاق المتوقع' : 'Target Close Date'}
              type="date"
              value={oppForm.closeDate}
              onChange={(e) => setOppForm({ ...oppForm, closeDate: e.target.value })}
            />
          </div>

          <Input
            label={isRtl ? 'ملاحظات وتفاصيل' : 'Notes'}
            value={oppForm.notes}
            onChange={(e) => setOppForm({ ...oppForm, notes: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowOpportunityModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingOpp}>
              {isRtl ? 'إنشاء الفرصة' : 'Create Deal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title={isRtl ? 'جدولة نشاط أو مهمة' : 'Schedule Activity'}
        maxWidth="md"
      >
        <form onSubmit={handleCreateActivity} className="space-y-3.5">
          <Select
            label={isRtl ? 'نوع النشاط' : 'Activity Type'}
            required
            value={activityForm.type}
            onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
          >
            <option value="CALL">{isRtl ? 'مكالمة هاتفية (Call)' : 'Phone Call'}</option>
            <option value="MEETING">{isRtl ? 'اجتماع عمل (Meeting)' : 'Meeting'}</option>
            <option value="EMAIL">{isRtl ? 'رسالة بريد إلكتروني' : 'Email'}</option>
            <option value="TASK">{isRtl ? 'مهمة عمل (Task)' : 'Task'}</option>
          </Select>

          <Input
            label={isRtl ? 'موضوع النشاط' : 'Subject'}
            required
            value={activityForm.subject}
            onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
            placeholder={isRtl ? 'متابعة عرض السعر هاتفياً' : 'Follow-up on quotation'}
          />

          <Input
            label={isRtl ? 'تاريخ ووقت الاستحقاق' : 'Due Date & Time'}
            type="datetime-local"
            value={activityForm.dueDate}
            onChange={(e) => setActivityForm({ ...activityForm, dueDate: e.target.value })}
          />

          <Input
            label={isRtl ? 'تفاصيل إضافية' : 'Description'}
            value={activityForm.description}
            onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowActivityModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingAct}>
              {isRtl ? 'جدولة النشاط' : 'Schedule'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
