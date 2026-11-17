import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  CrmActionType,
  CrmHistoryEntry,
  CrmLead,
  CrmStatus,
  PlaceSearchResult,
  SearchLog,
  WebsiteClassification,
} from '../types/lead';
import { db, handleFirestoreError, OperationType } from './firebase';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

function clampStr(val: string | undefined | null, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: clampStr(user.displayName || user.email?.split('@')[0] || 'Consultor Comercial', 120),
        email: clampStr(user.email || '', 200),
        photoURL: clampStr(user.photoURL || '', 500),
        companyName: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: clampStr(user.displayName || snap.data().displayName || 'Consultor Comercial', 120),
        photoURL: clampStr(user.photoURL || '', 500),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function timestampToMillis(ts: unknown): number {
  if (
    ts &&
    typeof ts === 'object' &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function subscribeToCrmLeads(
  userId: string,
  onData: (leads: CrmLead[]) => void
): Unsubscribe {
  const path = `users/${userId}/leads`;
  const q = query(
    collection(db, 'users', userId, 'leads'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CrmLead[] = snapshot.docs
        .map((d) => d.data() as CrmLead)
        .sort((a, b) => timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToLeadHistory(
  userId: string,
  leadId: string,
  onData: (entries: CrmHistoryEntry[]) => void
): Unsubscribe {
  const path = `users/${userId}/leads/${leadId}/history`;
  const q = query(
    collection(db, 'users', userId, 'leads', leadId, 'history'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CrmHistoryEntry[] = snapshot.docs
        .map((d) => d.data() as CrmHistoryEntry)
        .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToSearchLogs(
  userId: string,
  onData: (logs: SearchLog[]) => void
): Unsubscribe {
  const path = `users/${userId}/searchLogs`;
  const q = query(
    collection(db, 'users', userId, 'searchLogs'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SearchLog[] = snapshot.docs
        .map((d) => d.data() as SearchLog)
        .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function savePlaceToCrm(
  userId: string,
  place: PlaceSearchResult,
  context: {
    segment: string;
    city: string;
    state: string;
    neighborhood: string;
    initialNotes?: string;
  }
): Promise<string> {
  const leadId = sanitizeId(place.placeId);
  const path = `users/${userId}/leads/${leadId}`;
  const leadRef = doc(db, 'users', userId, 'leads', leadId);

  try {
    const existing = await getDoc(leadRef);
    if (existing.exists()) {
      return leadId;
    }

    const historyId = generateId('hist');
    const historyRef = doc(db, 'users', userId, 'leads', leadId, 'history', historyId);

    const batch = writeBatch(db);
    batch.set(leadRef, {
      id: leadId,
      ownerId: userId,
      placeId: sanitizeId(place.placeId),
      crmName: clampStr(place.name, 180) || 'Empresa sem nome',
      segment: clampStr(context.segment || place.category, 100),
      city: clampStr(context.city, 100),
      state: clampStr(context.state, 50),
      neighborhood: clampStr(context.neighborhood, 100),
      websiteClassification: place.websiteClassification,
      crmStatus: 'novo' as CrmStatus,
      notes: clampStr(context.initialNotes || '', 3000),
      contactDate: '',
      contactChannel: '',
      customPhone: '',
      estimatedTicket: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(historyRef, {
      id: historyId,
      ownerId: userId,
      leadId,
      actionType: 'lead_criado' as CrmActionType,
      fromStatus: '',
      toStatus: 'novo',
      note: clampStr(
        place.hasWebsiteUri
          ? 'Lead importado para o CRM (site informado no perfil do Google).'
          : 'Lead importado para o CRM com classificação SEM SITE INFORMADO NO GOOGLE.',
        1000
      ),
      contactDate: '',
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return leadId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLeadStatusAction(
  userId: string,
  lead: CrmLead,
  newStatus: CrmStatus,
  options?: {
    contactDate?: string;
    contactChannel?: string;
    historyNote?: string;
  }
): Promise<void> {
  const path = `users/${userId}/leads/${lead.id}`;
  const leadRef = doc(db, 'users', userId, 'leads', lead.id);
  const historyId = generateId('hist');
  const historyRef = doc(db, 'users', userId, 'leads', lead.id, 'history', historyId);

  const nextContactDate = clampStr(
    options?.contactDate !== undefined ? options.contactDate : lead.contactDate,
    32
  );
  const nextChannel = clampStr(
    options?.contactChannel !== undefined ? options.contactChannel : lead.contactChannel,
    40
  );

  try {
    const batch = writeBatch(db);
    batch.update(leadRef, {
      crmStatus: newStatus,
      contactDate: nextContactDate,
      contactChannel: nextChannel,
      updatedAt: serverTimestamp(),
    });

    batch.set(historyRef, {
      id: historyId,
      ownerId: userId,
      leadId: lead.id,
      actionType: 'status_alterado' as CrmActionType,
      fromStatus: clampStr(lead.crmStatus, 30),
      toStatus: clampStr(newStatus, 30),
      note: clampStr(
        options?.historyNote || `Etapa comercial alterada de "${lead.crmStatus}" para "${newStatus}".`,
        1000
      ),
      contactDate: nextContactDate,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLeadCommercialRecord(
  userId: string,
  lead: CrmLead,
  updates: {
    crmName: string;
    crmStatus: CrmStatus;
    contactDate: string;
    contactChannel: string;
    notes: string;
    customPhone: string;
    estimatedTicket: number;
    websiteClassification: WebsiteClassification;
    segment: string;
    city: string;
    state: string;
    neighborhood: string;
  },
  historyEntry?: {
    actionType: CrmActionType;
    note: string;
  }
): Promise<void> {
  const path = `users/${userId}/leads/${lead.id}`;
  const leadRef = doc(db, 'users', userId, 'leads', lead.id);

  const safeTicket = Number.isFinite(updates.estimatedTicket)
    ? Math.min(10000000, Math.max(0, Number(updates.estimatedTicket)))
    : 0;

  try {
    const batch = writeBatch(db);
    batch.update(leadRef, {
      crmName: clampStr(updates.crmName, 180) || lead.crmName,
      crmStatus: updates.crmStatus,
      contactDate: clampStr(updates.contactDate, 32),
      contactChannel: clampStr(updates.contactChannel, 40),
      notes: clampStr(updates.notes, 3000),
      customPhone: clampStr(updates.customPhone, 40),
      estimatedTicket: safeTicket,
      websiteClassification: updates.websiteClassification,
      segment: clampStr(updates.segment, 100),
      city: clampStr(updates.city, 100),
      state: clampStr(updates.state, 50),
      neighborhood: clampStr(updates.neighborhood, 100),
      updatedAt: serverTimestamp(),
    });

    if (historyEntry) {
      const historyId = generateId('hist');
      const historyRef = doc(db, 'users', userId, 'leads', lead.id, 'history', historyId);
      batch.set(historyRef, {
        id: historyId,
        ownerId: userId,
        leadId: lead.id,
        actionType: historyEntry.actionType,
        fromStatus: clampStr(lead.crmStatus, 30),
        toStatus: clampStr(updates.crmStatus, 30),
        note: clampStr(historyEntry.note, 1000),
        contactDate: clampStr(updates.contactDate, 32),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addLeadHistoryEntry(
  userId: string,
  lead: CrmLead,
  entry: {
    actionType: CrmActionType;
    note: string;
    contactDate?: string;
  }
): Promise<void> {
  const path = `users/${userId}/leads/${lead.id}/history`;
  const historyId = generateId('hist');
  const historyRef = doc(db, 'users', userId, 'leads', lead.id, 'history', historyId);
  const leadRef = doc(db, 'users', userId, 'leads', lead.id);
  const nextDate = clampStr(entry.contactDate ?? lead.contactDate, 32);

  try {
    const batch = writeBatch(db);
    batch.set(historyRef, {
      id: historyId,
      ownerId: userId,
      leadId: lead.id,
      actionType: entry.actionType,
      fromStatus: clampStr(lead.crmStatus, 30),
      toStatus: clampStr(lead.crmStatus, 30),
      note: clampStr(entry.note, 1000),
      contactDate: nextDate,
      createdAt: serverTimestamp(),
    });

    if (entry.contactDate !== undefined) {
      batch.update(leadRef, {
        crmStatus: lead.crmStatus,
        contactDate: nextDate,
        contactChannel: clampStr(lead.contactChannel, 40),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteLeadFromCrm(userId: string, leadId: string): Promise<void> {
  const path = `users/${userId}/leads/${leadId}`;
  const leadRef = doc(db, 'users', userId, 'leads', leadId);
  const historyQuery = query(
    collection(db, 'users', userId, 'leads', leadId, 'history'),
    where('ownerId', '==', userId)
  );

  try {
    const historySnap = await getDocs(historyQuery);
    const batch = writeBatch(db);
    historySnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(leadRef);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function logSearchSession(
  userId: string,
  payload: {
    queryText: string;
    country: string;
    state: string;
    city: string;
    neighborhood: string;
    segment: string;
    totalFound: number;
    withoutWebsiteCount: number;
    withWebsiteCount: number;
    withPhoneCount: number;
  }
): Promise<void> {
  const searchId = generateId('srch');
  const path = `users/${userId}/searchLogs/${searchId}`;
  const ref = doc(db, 'users', userId, 'searchLogs', searchId);

  try {
    await setDoc(ref, {
      id: searchId,
      ownerId: userId,
      queryText: clampStr(payload.queryText, 200) || 'Pesquisa',
      country: clampStr(payload.country, 80),
      state: clampStr(payload.state, 80),
      city: clampStr(payload.city, 100),
      neighborhood: clampStr(payload.neighborhood, 100),
      segment: clampStr(payload.segment, 100),
      totalFound: Math.min(1000, Math.max(0, Math.round(payload.totalFound))),
      withoutWebsiteCount: Math.min(1000, Math.max(0, Math.round(payload.withoutWebsiteCount))),
      withWebsiteCount: Math.min(1000, Math.max(0, Math.round(payload.withWebsiteCount))),
      withPhoneCount: Math.min(1000, Math.max(0, Math.round(payload.withPhoneCount))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
