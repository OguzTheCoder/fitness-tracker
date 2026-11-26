import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';

function jsonResponse(status: number, body: unknown, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

const sampleProfilePayload = {
  profile: {
    id: 'u1',
    name: 'Oğuz',
    email: 'personal@local.fitness',
    dailyCalorieGoal: 2000,
    proteinGoalG: 150,
    carbsGoalG: 200,
    fatGoalG: 65,
    dailyStepGoal: 8000,
    visibleMicronutrients: ['Na', 'K', 'Mg', 'Ca', 'Fe', 'Zn'],
  },
  availableMicronutrients: [
    { key: 'Na', label: 'Sodyum (Na)', unit: 'mg', category: 'mineral' },
    { key: 'K', label: 'Potasyum (K)', unit: 'mg', category: 'mineral' },
  ],
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Backup & Export/Import Section (AUTH-13 / v1.4.0)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads full JSON backup and selected CSV dataset from /profile', async () => {
    const user = userEvent.setup();
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    const createObjectUrlSpy = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectUrlSpy = vi.fn();
    URL.createObjectURL = createObjectUrlSpy;
    URL.revokeObjectURL = revokeObjectUrlSpy;
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    try {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          jsonResponse(200, {
            mode: 'local',
            isConfigured: true,
            isAuthenticated: true,
            user: {
              id: 'u1',
              name: 'Oğuz',
              email: 'personal@local.fitness',
              createdAt: '2026-11-26',
            },
          }),
        )
        .mockResolvedValueOnce(jsonResponse(200, sampleProfilePayload))
        .mockResolvedValueOnce(
          jsonResponse(
            200,
            { schemaVersion: 1, data: {} },
            {
              'Content-Disposition':
                'attachment; filename="fitness-tracker-backup-2026-11-26.json"',
            },
          ),
        )
        .mockResolvedValueOnce(
          new Response('\uFEFFTarih,Öğün,Kalori (kcal)\r\n2026-11-26,Kahvaltı,500\r\n', {
            status: 200,
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition':
                'attachment; filename="fitness-tracker-calories-2026-11-26.csv"',
            },
          }),
        );

      renderProfile();

      expect(
        await screen.findByRole('heading', { name: 'Yedekleme & Veri Dışa Aktarma' }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Tam JSON Yedek İndir' }));
      expect(
        await screen.findByText(
          /Tam JSON yedeğin indirildi \(fitness-tracker-backup-2026-11-26\.json\)/,
        ),
      ).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('CSV veri seti'), 'calories');
      await user.click(screen.getByRole('button', { name: 'CSV İndir' }));
      expect(
        await screen.findByText(
          /CSV tablosu indirildi \(fitness-tracker-calories-2026-11-26\.csv\)/,
        ),
      ).toBeInTheDocument();

      expect(String(fetchSpy.mock.calls[2]?.[0])).toContain('/backup/export?format=json');
      expect(fetchSpy.mock.calls[2]?.[1]?.credentials).toBe('include');
      expect(String(fetchSpy.mock.calls[3]?.[0])).toContain(
        '/backup/export?format=csv&dataset=calories',
      );
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(2);
      expect(revokeObjectUrlSpy).toHaveBeenCalledTimes(2);
      expect(anchorClickSpy).toHaveBeenCalledTimes(2);
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });

  it('imports JSON backup in merge mode with prefer_backup strategy, shows summary, and refreshes profile', async () => {
    const user = userEvent.setup();
    const updatedProfile = {
      ...sampleProfilePayload,
      profile: {
        ...sampleProfilePayload.profile,
        name: 'Oğuz Güncel',
        dailyCalorieGoal: 2500,
      },
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          mode: 'local',
          isConfigured: true,
          isAuthenticated: true,
          user: { id: 'u1', name: 'Oğuz', email: 'personal@local.fitness', createdAt: '2026-11-26' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, sampleProfilePayload))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          mode: 'merge',
          conflictStrategy: 'prefer_backup',
          profileUpdated: true,
          summary: {
            imported: { weights: 2 },
            updated: { steps: 1 },
            skipped: { cardio: 1 },
          },
          totals: { imported: 2, updated: 1, skipped: 1 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, updatedProfile));

    renderProfile();
    await screen.findByRole('heading', { name: 'Yedekleme & Veri Dışa Aktarma' });

    const validBackup = {
      schemaVersion: 1,
      app: 'fitness-tracker',
      data: {
        weights: [{ date: '2026-11-25', weightKg: 80.5 }],
        steps: [{ date: '2026-11-25', steps: 9200 }],
      },
    };
    const file = new File([JSON.stringify(validBackup)], 'my-backup.json', {
      type: 'application/json',
    });

    const input = screen.getByLabelText(/JSON Yedek Dosyası/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/my-backup\.json/)).toBeInTheDocument();
    expect(screen.getByText(/Şema v1 · 2 kayıt/)).toBeInTheDocument();

    // Both conflict options are clearly visible in merge mode
    expect(screen.getByText('Mevcut kayıtları koru')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Yedekteki kayıtları önceliklendir/i));

    await user.click(screen.getByRole('button', { name: 'Yedeği Birleştir' }));

    expect(
      await screen.findByText('Yedek verileri hesabınla başarıyla birleştirildi.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Eklenen: 2')).toBeInTheDocument();
    expect(screen.getByText('Güncellenen: 1')).toBeInTheDocument();
    expect(screen.getByText('Korunan / Atlanan: 1')).toBeInTheDocument();

    const importBody = JSON.parse(String(fetchSpy.mock.calls[2]?.[1]?.body));
    expect(importBody.mode).toBe('merge');
    expect(importBody.conflictStrategy).toBe('prefer_backup');

    await waitFor(() => {
      expect(screen.getByLabelText('Ad')).toHaveValue('Oğuz Güncel');
    });
  });

  it('requires explicit confirmation for overwrite mode and rejects malformed JSON files client-side', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          mode: 'local',
          isConfigured: true,
          isAuthenticated: true,
          user: { id: 'u1', name: 'Oğuz', email: 'personal@local.fitness', createdAt: '2026-11-26' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, sampleProfilePayload))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          mode: 'overwrite',
          conflictStrategy: 'keep_existing',
          profileUpdated: false,
          summary: {},
          totals: { imported: 1, updated: 0, skipped: 0 },
        }),
      );

    renderProfile();
    await screen.findByRole('heading', { name: 'Yedekleme & Veri Dışa Aktarma' });

    const input = screen.getByLabelText(/JSON Yedek Dosyası/i) as HTMLInputElement;

    // 1. Malformed JSON shows alert and does not call API
    const badFile = new File(['{ bozuk json'], 'broken.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [badFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Seçilen dosya geçerli bir JSON biçiminde değil.',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // 2. Valid file + Overwrite requires confirmation checkbox
    const goodFile = new File(
      [JSON.stringify({ schemaVersion: 1, data: { weights: [{ date: '2026-11-25', weightKg: 81 }] } })],
      'valid.json',
      { type: 'application/json' },
    );
    fireEvent.change(input, { target: { files: [goodFile] } });
    expect(await screen.findByText(/valid\.json/)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Üzerine Yaz \(Overwrite\)/i));
    const submitBtn = screen.getByRole('button', { name: 'Mevcut Verilerin Üzerine Yaz' });
    expect(submitBtn).toBeDisabled();

    await user.click(
      screen.getByLabelText(/Mevcut tüm kişisel verilerimin silinip yalnızca seçili yedek/i),
    );
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);
    expect(
      await screen.findByText('Mevcut verilerin üzerine yedek başarıyla yüklendi.'),
    ).toBeInTheDocument();

    const importBody = JSON.parse(String(fetchSpy.mock.calls[2]?.[1]?.body));
    expect(importBody.mode).toBe('overwrite');
  });
});
