
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CommunicationMessage, CommunicationChannel } from '@/types/repairs';
import { toast } from 'sonner';

function openExternalApp(
  channel: CommunicationChannel,
  content: string,
  customerPhone?: string,
  customerEmail?: string
): boolean {
  try {
    if (channel === 'whatsapp' && customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(content)}`;
      // Use window.open for WhatsApp Web/Desktop redirect
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      return Boolean(win);
    }

    if (channel === 'email' && customerEmail) {
      const subject = encodeURIComponent('Actualización reparación');
      const body = encodeURIComponent(content);
      window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
      return true;
    }

    if (channel === 'sms' && customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      const body = encodeURIComponent(content);
      // Modern mobile browsers handle sms: protocol well
      window.location.href = `sms:${cleanPhone}?body=${body}`;
      return true;
    }
  } catch (error) {
    console.error('Error opening external app:', error);
  }

  return false;
}

export function useRepairCommunications(repairId: string | undefined) {
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!repairId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('communication_messages')
      .select('*')
      .eq('repair_id', repairId)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error al cargar historial de mensajes');
      setLoading(false);
      return;
    }

    const mapped: CommunicationMessage[] = (data || []).map((m: any) => ({
      id: m.id,
      repairId: m.repair_id,
      channel: m.channel as CommunicationChannel,
      content: m.content,
      sentAt: m.sent_at,
      status: m.status as 'pending' | 'sent' | 'failed',
    }));

    setMessages(mapped);
    setLoading(false);
  }, [repairId]);

  useEffect(() => {
    fetchMessages();

    if (!repairId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`comms-${repairId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_messages',
          filter: `repair_id=eq.${repairId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, repairId]);

  const sendMessage = async (
    channel: CommunicationChannel,
    content: string,
    customerPhone?: string,
    customerEmail?: string,
    templateId?: string
  ) => {
    if (!repairId) return false;

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error('El contenido del mensaje está vacío');
      return false;
    }

    if (channel === 'whatsapp' || channel === 'sms') {
      if (!customerPhone) {
        toast.error('El cliente no tiene teléfono registrado');
        return false;
      }
      const cleanPhone = customerPhone.replace(/\D/g, '');
      if (cleanPhone.length < 6) { // Relaxed validation
        toast.error('Número de teléfono inválido');
        return false;
      }
    }

    if (channel === 'email') {
      if (!customerEmail) {
        toast.error('El cliente no tiene email registrado');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        toast.error('Formato de email inválido');
        return false;
      }
    }

    const supabase = createClient();

    // 1. Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    const newMessage: CommunicationMessage = {
      id: tempId,
      repairId,
      channel,
      content: trimmedContent,
      sentAt: new Date().toISOString(),
      status: 'pending',
    };
    setMessages(prev => [newMessage, ...prev]);

    // 2. Try to open external app first
    const opened = openExternalApp(channel, trimmedContent, customerPhone, customerEmail);
    const finalStatus = opened ? 'sent' : 'failed';

    // 3. Save to DB asynchronously
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('communication_messages')
        .insert({
          repair_id: repairId,
          channel,
          content: trimmedContent,
          template_id: templateId,
          status: finalStatus, // Save directly with final status
          direction: 'outbound',
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Update the optimistic message with real ID
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: inserted.id, status: finalStatus } : m));

      if (opened) {
        toast.success(`App de ${channel} abierta`);
        return true;
      } else {
        toast.error(`No se pudo abrir la app de ${channel}`);
        return false;
      }

    } catch (error) {
      console.error('Error saving message:', error);
      toast.error('Error al guardar en historial');
      // Rollback optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      return false;
    }
  };

  return { messages, loading, sendMessage, refresh: fetchMessages };
}
