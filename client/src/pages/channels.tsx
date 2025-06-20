import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import ChannelTable from "@/components/channels/channel-table";
import EnhancedChannelForm from "@/components/channels/enhanced-channel-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Channel } from "@shared/schema";

export default function Channels() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  const { data: channels, isLoading, refetch } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleAddChannel = () => {
    setEditingChannel(null);
    setIsFormOpen(true);
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingChannel(null);
    refetch();
  };

  return (
    <>
      <Header
        title="Channel Management"
        description="Manage your YouTube channels with comprehensive automation settings, branding, and scheduling"
        onRefresh={handleRefresh}
        onAdd={handleAddChannel}
        addButtonText="Add Channel"
      />

      <div className="p-6">
        <ChannelTable 
          channels={channels || []} 
          isLoading={isLoading}
          onRefresh={refetch}
          onEdit={handleEditChannel}
        />
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? 'Edit Channel Settings' : 'Add New Channel'}
            </DialogTitle>
          </DialogHeader>
          <EnhancedChannelForm
            channelId={editingChannel?.id}
            onSuccess={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
