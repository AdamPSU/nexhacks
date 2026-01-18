"use client";

import { useState, useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Search,
  Edit2,
  ArrowUpRight,
  Clock,
  FileIcon,
  MoreHorizontal
} from 'lucide-react';
import { toast } from "sonner";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { createWhiteboard, deleteWhiteboard, renameWhiteboard } from './actions';
import { ConstellationBackground } from '@/components/ConstellationBackground';

type Whiteboard = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  preview?: string;
};

export default function DashboardClient({ initialWhiteboards }: { initialWhiteboards: Whiteboard[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [optimisticWhiteboards, addOptimisticWhiteboard] = useOptimistic(
    initialWhiteboards,
    (state, action: { type: 'delete' | 'rename' | 'create', id?: string, title?: string, board?: Whiteboard }) => {
      switch (action.type) {
        case 'delete':
          return state.filter(w => w.id !== action.id);
        case 'rename':
          return state.map(w => w.id === action.id ? { ...w, title: action.title! } : w);
        case 'create':
          return [action.board!, ...state];
        default:
          return state;
      }
    }
  );

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const handleCreate = async () => {
    startTransition(async () => {
      try {
        const newBoard = await createWhiteboard();
        toast.success('Canvas created');
        router.push(`/board/${newBoard.id}`);
      } catch (error) {
        toast.error('Failed to create canvas');
      }
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      addOptimisticWhiteboard({ type: 'delete', id });
      try {
        await deleteWhiteboard(id);
        toast.success('Canvas deleted');
      } catch (error) {
        toast.error('Failed to delete canvas');
      }
    });
  };

  const handleRename = async () => {
    if (!renameId) return;
    const id = renameId;
    const title = renameTitle;
    
    setRenameId(null);
    startTransition(async () => {
      addOptimisticWhiteboard({ type: 'rename', id, title });
      try {
        await renameWhiteboard(id, title);
        toast.success('Canvas renamed');
      } catch (error) {
        toast.error('Failed to rename canvas');
      }
    });
  };

  const filteredWhiteboards = optimisticWhiteboards.filter(board =>
    board.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white relative">
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        <ConstellationBackground />
      </div>
      <main className="relative mx-auto max-w-6xl px-6 py-12 space-y-10" style={{ zIndex: 10 }}>
        <section className="rounded-[32px] border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="bg-black text-white dark:bg-white dark:text-black px-8 py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.35em] opacity-60">Dashboard</p>
                <h1 className="text-4xl font-semibold tracking-tight">Canvas Control</h1>
                <p className="text-sm opacity-70">Create, rename, and delete canvases in one place.</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70 dark:text-black/70" />
                  <Input
                    type="text"
                    placeholder="Search canvases"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 w-full rounded-full border border-white/20 bg-white/10 pl-9 text-sm text-white placeholder:text-white/50 focus-visible:ring-0 dark:border-black/20 dark:bg-black/10 dark:text-black dark:placeholder:text-black/40"
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={isPending}
                  className="h-11 rounded-full bg-white text-black hover:bg-neutral-100 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
                >
                  {isPending ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  New canvas
                </Button>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-black px-8 py-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                  Total canvases
                </p>
                <p className="mt-3 text-3xl font-semibold">{optimisticWhiteboards.length}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                  Visible
                </p>
                <p className="mt-3 text-3xl font-semibold">{filteredWhiteboards.length}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                  Quick start
                </p>
                <Button
                  onClick={handleCreate}
                  disabled={isPending}
                  className="mt-3 w-full rounded-full border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
                >
                  Create a blank board
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Canvases</h2>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
              {filteredWhiteboards.length} shown
            </p>
          </div>

          {filteredWhiteboards.length === 0 && (
            <div className="rounded-3xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900">
                <Search className="h-6 w-6 text-neutral-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No canvases yet</h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Create your first canvas or clear the search term.
              </p>
              <Button
                onClick={handleCreate}
                disabled={isPending}
                className="mt-6 rounded-full bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create canvas
              </Button>
            </div>
          )}

          {filteredWhiteboards.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={handleCreate}
                className="flex items-center gap-5 rounded-3xl border border-dashed border-neutral-300 p-5 text-left transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500 relative z-10 bg-white dark:bg-neutral-950"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                    New
                  </p>
                  <p className="mt-2 text-lg font-semibold">Create a fresh canvas</p>
                </div>
              </button>

              {filteredWhiteboards.map((board) => (
                <div
                  key={board.id}
                  className="group flex items-stretch gap-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 relative z-10"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/board/${board.id}`)}
                    className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-900"
                  >
                    {board.preview ? (
                      <img
                        src={board.preview}
                        alt={board.title}
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <FileIcon className="h-8 w-8 text-neutral-400" />
                    )}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold">{board.title}</h3>
                        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatTime(board.updated_at)}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full border border-transparent text-neutral-500 hover:border-neutral-200 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:border-neutral-800 dark:hover:bg-neutral-900"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setRenameId(board.id);
                            setRenameTitle(board.title);
                          }}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(board.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-full border-neutral-200 dark:border-neutral-800"
                        onClick={() => router.push(`/board/${board.id}`)}
                      >
                        Open canvas
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-full text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                        onClick={() => handleDelete(board.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Rename canvas</DialogTitle>
            <DialogDescription>
              Give your canvas a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name" className="mb-2 block text-sm">Canvas name</Label>
            <Input
              id="name"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setRenameId(null)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isPending} className="flex-1 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
