"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, MoreHorizontal } from "lucide-react";

import { getOffers, createOffer, updateOffer, deleteOffer, Offer } from "@/lib/api/offers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export default function OffersDashboard() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  const [formData, setFormData] = useState<Partial<Offer>>({
    title: "",
    slug: "",
    summary: "",
    amount: 0,
    isPremium: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["offers", page, search],
    queryFn: () => getOffers({ page, limit: 10, q: search }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Offer>) => {
      if (selectedOffer) return updateOffer(selectedOffer.id, payload);
      return createOffer(payload);
    },
    onSuccess: () => {
      toast.success(selectedOffer ? "Offer updated" : "Offer created");
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      closeDialog();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Operation failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      toast.success("Offer deleted");
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Delete failed"),
  });

  const openDialog = (offer?: Offer) => {
    if (offer) {
      setSelectedOffer(offer);
      setFormData({
        title: offer.title,
        slug: offer.slug,
        summary: offer.summary,
        amount: offer.amount,
        isPremium: offer.isPremium,
      });
    } else {
      setSelectedOffer(null);
      setFormData({ title: "", slug: "", summary: "", amount: 0, isPremium: false });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedOffer(null);
  };

  const handleSave = () => {
    if (!formData.title || !formData.slug) {
      return toast.error("Title and slug are required");
    }
    saveMutation.mutate(formData);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this offer?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offers..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Offer
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] float-right" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  No offers found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.title}</TableCell>
                  <TableCell className="text-muted-foreground">{offer.slug}</TableCell>
                  <TableCell>${offer.amount}</TableCell>
                  <TableCell>{offer.isPremium ? "Yes" : "No"}</TableCell>
                  <TableCell>{format(new Date(offer.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(offer)}>
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(offer.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedOffer ? "Edit Offer" : "Create Offer"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Title</Label>
              <Input
                className="col-span-3"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Slug</Label>
              <Input
                className="col-span-3"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Summary</Label>
              <Input
                className="col-span-3"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Amount ($)</Label>
              <Input
                type="number"
                className="col-span-3"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Premium</Label>
              <div className="col-span-3 flex items-center">
                <Switch
                  checked={formData.isPremium}
                  onCheckedChange={(c) => setFormData({ ...formData, isPremium: c })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
