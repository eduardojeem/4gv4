import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { CommunicationMessage, CommunicationChannel } from '@/types/repairs';
import { toast } from 'sonner';

export function useRepairCommunications(repairId: string | undefined) {
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!repairId) {
        setMessages([]);
        return;
    }
    setLoading(true);
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('communication_messages')
      .select('*')
      .eq('repair_id', repairId)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error al cargar historial de mensajes');
    } else {
      // Map DB snake_case to TS camelCase
      const mapped: CommunicationMessage[] = (data || []).map((m: any) => ({
        id: m.id,
        repairId: m.repair_id,
        channel: m.channel as CommunicationChannel,
        content: m.content,
        sentAt: m.sent_at,
        status: m.status as 'sent' | 'failed',
      }));
      setMessages(mapped);
    }
    setLoading(false);
  }, [repairId]);

  useEffect(() => {
    fetchMessages();
    
    // Optional: Realtime subscription
    if (!repairId) return;
    const supabase = createSupabaseClient();
    const channel = supabase
        .channel(`comms-${repairId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'communication_messages',
            filter: `repair_id=eq.${repairId}` 
        }, () => {
            fetchMessages();
        })
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
    const supabase = createSupabaseClient();
    
    // External Dispatch Logic (Simulation)
    try {
        if (channel === 'whatsapp' && customerPhone) {
            const url = `https://wa.me/${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(content)}`;
            window.open(url, '_blank');
        } else if (channel === 'email' && customerEmail) {
            const url = `mailto:${customerEmail}?subject=${encodeURIComponent(`Actualización reparación`)}&body=${encodeURIComponent(content)}`;
            window.location.href = url;
        } else if (channel === 'sms' && customerPhone) {
            const url = `sms:${customerPhone.replace(/\D/g, '')}?body=${encodeURIComponent(content)}`;
            window.location.href = url;
        }
    } catch (e) {
        console.error("Error opening external app", e);
    }

    // DB Insert
    const { error } = await supabase.from('communication_messages').insert({
      repair_id: repairId,
      channel,
      content,
      template_id: templateId,
      status: 'sent',
      direction: 'outbound'
    });

    if (error) {
      console.error('Error saving message:', error);
      toast.error('Error al guardar el mensaje en historial');
      return false;
    }
    
    return true;
  };

  return { messages, loading, sendMessage, refresh: fetchMessages };
}
