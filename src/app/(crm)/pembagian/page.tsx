import { Suspense } from 'react';
import Link from 'next/link';
import { Clock, Send, Shuffle, Users } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { DISTRIBUTION_START, DISTRIBUTION_WAIT_DAYS } from '@/lib/config';
import { csOptions } from '@/lib/customerQuery';
import { getView } from '@/lib/dataset';
import { listTeam, pendingCustomers } from '@/lib/pembagian';
import { Card, Empty, Kpi, LoadingBlock, PageHeader } from '@/components/ui';
import { AddMemberForm } from '@/components/PembagianForms';
import { formatDate, formatNumber, formatPhone } from '@/utils/formatters';
import { distributeNow, removeMember, toggleMember } from './actions';

export default function PembagianPage() {
  return (
    <>
      <PageHeader
        title="Pembagian Customer ke CRM"
        description={`Customer baru dari CSO (order pertama lewat iklan / WA sejak ${formatDate(DISTRIBUTION_START)}) dibagikan otomatis dan rata ke tim CRM aktif setiap data dimuat ulang.`}
      />
      <Suspense fallback={<LoadingBlock />}>
        <Pembagian />
      </Suspense>
    </>
  );
}

async function Pembagian() {
  await requireAdmin();
  const { ds, view } = await getView('all');
  const team = await listTeam();
  const pending = pendingCustomers(ds);
  const assigned = [...ds.assignments.values()].filter((a) => a.firstDate >= DISTRIBUTION_START);
  const thisMonth = ds.refDate.slice(0, 7);

  const perCrm = new Map<string, { total: number; month: number; ro: number }>();
  for (const a of assigned) {
    let s = perCrm.get(a.crm);
    if (!s) perCrm.set(a.crm, (s = { total: 0, month: 0, ro: 0 }));
    s.total++;
    if (a.firstDate.startsWith(thisMonth)) s.month++;
    if ((view.byPhone.get(a.phone)?.orders ?? 0) > 1) s.ro++;
  }
  const crmNames = [...new Set([...team.map((m) => m.nama), ...perCrm.keys()])];
  const recent = [...assigned].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 30);
  const activeTeam = team.filter((m) => m.aktif);

  return (
    <>
      <div className="stats-grid">
        <Kpi
          label="Customer Baru CSO"
          value={formatNumber(assigned.length + pending.length)}
          hint={`Sejak ${formatDate(DISTRIBUTION_START)}, tanpa order retur`}
          icon={Users}
        />
        <Kpi label="Sudah Dibagikan" value={formatNumber(assigned.length)} hint="Ke CRM (otomatis + manual)" icon={Shuffle} tone="emerald" />
        <Kpi
          label="Menunggu"
          value={formatNumber(pending.length)}
          hint={`Paket belum tercatat diterima & order < ${DISTRIBUTION_WAIT_DAYS} hari`}
          icon={Clock}
          tone="amber"
        />
        <Kpi label="Tim CRM Aktif" value={formatNumber(activeTeam.length)} hint={`${team.length} orang terdaftar`} icon={Send} tone="purple" />
      </div>

      {activeTeam.length === 0 && (
        <div className="note">
          <span>
            Belum ada anggota tim CRM yang aktif, jadi pembagian otomatis belum berjalan. Tambahkan nama CRM di bawah.
          </span>
        </div>
      )}

      <div className="grid-2">
        <Card
          title="Tim CRM & Hasil Pembagian"
          description={`Customer dibagi rata per bulan order pertama. "Sudah RO" = customer bagian CRM tsb yang sudah beli lagi.`}
          actions={
            <form action={distributeNow}>
              <button className="btn-ghost" type="submit" disabled={activeTeam.length === 0}>
                <Shuffle size={15} /> Bagikan sekarang
              </button>
            </form>
          }
        >
          {crmNames.length === 0 ? (
            <Empty>Belum ada tim CRM.</Empty>
          ) : (
            <div className="table-wrapper">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>CRM</th>
                    <th>Status</th>
                    <th className="num">Bulan ini</th>
                    <th className="num">Total</th>
                    <th className="num">Sudah RO</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {crmNames.map((nama) => {
                    const member = team.find((m) => m.nama === nama);
                    const s = perCrm.get(nama) ?? { total: 0, month: 0, ro: 0 };
                    return (
                      <tr key={nama} className={member?.aktif ? undefined : 'row-muted'}>
                        <td>
                          <Link className="link strong" href={`/customers?produk=all&crm=${encodeURIComponent(nama)}&sumber=cso&sort=lama`}>
                            {nama}
                          </Link>
                        </td>
                        <td>
                          <span className={`pill tone-${member?.aktif ? 'success' : 'danger'}`}>
                            {member ? (member.aktif ? 'Menerima' : 'Berhenti') : 'Bukan anggota'}
                          </span>
                        </td>
                        <td className="num">{formatNumber(s.month)}</td>
                        <td className="num">{formatNumber(s.total)}</td>
                        <td className="num">{formatNumber(s.ro)}</td>
                        <td className="nowrap">
                          {member && (
                            <div className="inline-form">
                              <form action={toggleMember}>
                                <input type="hidden" name="nama" value={nama} />
                                <input type="hidden" name="aktif" value={member.aktif ? '1' : '0'} />
                                <button className="link" type="submit">
                                  {member.aktif ? 'Hentikan' : 'Aktifkan'}
                                </button>
                              </form>
                              {s.total === 0 && (
                                <form action={removeMember}>
                                  <input type="hidden" name="nama" value={nama} />
                                  <button className="link" type="submit">
                                    Hapus
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Tambah Anggota Tim CRM"
          description="Pakai nama yang sama dengan Nama CS di akun login agar CRM mudah memfilter customer bagiannya."
        >
          <AddMemberForm suggestions={csOptions(view)} />
        </Card>
      </div>

      <Card title="Pembagian Terbaru" description="30 customer terakhir yang dibagikan. CRM pemegang bisa diubah dari halaman detail customer.">
        {recent.length === 0 ? (
          <Empty>Belum ada customer yang dibagikan.</Empty>
        ) : (
          <div className="table-wrapper">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Order pertama</th>
                  <th>CSO</th>
                  <th>CRM</th>
                  <th>Cara</th>
                  <th>Dibagikan</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.phone}>
                    <td>
                      <Link className="link strong" href={`/customers/${a.phone}?produk=all`}>
                        {view.byPhone.get(a.phone)?.name ?? formatPhone(a.phone)}
                      </Link>
                      <div className="muted-small">{formatPhone(a.phone)}</div>
                    </td>
                    <td className="nowrap">{a.firstDate ? formatDate(a.firstDate) : '-'}</td>
                    <td>{a.cso || '-'}</td>
                    <td>
                      <strong>{a.crm}</strong>
                    </td>
                    <td>
                      <span className={`pill ${a.method === 'manual' ? 'tone-info' : ''}`}>
                        {a.method === 'manual' ? `Manual${a.by ? ` (${a.by})` : ''}` : 'Otomatis'}
                      </span>
                    </td>
                    <td className="nowrap">{formatDate(a.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
