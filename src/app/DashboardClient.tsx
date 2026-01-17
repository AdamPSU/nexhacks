"use client";

import { useState, useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Trash2, 
  Clock, 
  FileIcon, 
  Search, 
  LayoutGrid, 
  List as ListIcon, 
  Edit2,
  MoreHorizontal
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createWhiteboard, deleteWhiteboard, renameWhiteboard } from './actions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Optimistic State
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

  // Rename state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const handleCreate = async () => {
    startTransition(async () => {
      try {
        const newBoard = await createWhiteboard();
        toast.success('Whiteboard created');
        router.push(`/board/${newBoard.id}`);
      } catch (error) {
        toast.error('Failed to create whiteboard');
      }
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      addOptimisticWhiteboard({ type: 'delete', id });
      try {
        await deleteWhiteboard(id);
        toast.success('Whiteboard deleted');
      } catch (error) {
        toast.error('Failed to delete whiteboard');
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
        toast.success('Whiteboard renamed');
      } catch (error) {
        toast.error('Failed to rename whiteboard');
      }
    });
  };

  const filteredWhiteboards = optimisticWhiteboards.filter(board => 
    board.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-6">
        <div className="space-y-4 mb-4">
          <h1 className="text-4xl font-bold tracking-tight">My Whiteboards</h1>
          
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                type="text"
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button 
              onClick={handleCreate}
              disabled={isPending}
              className="h-10 w-full sm:w-auto"
            >
              {isPending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              New Board
            </Button>
            
            <div className="flex items-center gap-2 bg-card p-1 rounded-lg border shadow-sm">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon-lg"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon-lg"
                onClick={() => setViewMode('list')}
              >
                <ListIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className={cn(
          viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
            : "flex flex-col gap-3"
        )}>
          {viewMode === 'grid' && (
            <div 
              onClick={handleCreate}
              className="flex flex-col items-center justify-center h-64 bg-card border-2 border-dashed rounded-xl cursor-pointer hover:bg-accent transition-colors"
            >
              <div className="p-4 rounded-full bg-muted">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <span className="mt-4 font-medium text-muted-foreground">
                Create New Board
              </span>
            </div>
          )}

          {filteredWhiteboards.map((board) => (
            <div 
              key={board.id}
              className={cn(
                "group relative bg-card border hover:border-ring/50 transition-all overflow-hidden",
                viewMode === 'grid' 
                  ? "flex flex-col h-64 rounded-xl shadow-sm hover:shadow-md" 
                  : "flex items-center p-4 rounded-lg hover:bg-accent/50"
              )}
            >
              <div 
                  className={cn("flex-1 cursor-pointer", viewMode === 'list' && "flex items-center gap-4")}
                  onClick={() => router.push(`/board/${board.id}`)}
              >
                  {viewMode === 'grid' ? (
                    <div className="flex-1 h-40 bg-muted flex items-center justify-center relative overflow-hidden border-b">
                        {board.preview ? (
                            <img 
                                src={board.preview} 
                                alt={board.title}
                                className="w-full h-full object-cover" 
                            />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
                                <FileIcon className="w-12 h-12 text-muted-foreground/50 group-hover:scale-110 transition-transform duration-300" />
                            </>
                        )}
                    </div>
                  ) : (
                    <div className="p-2 bg-muted rounded-lg">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className={cn("min-w-0", viewMode === 'grid' && "p-4")}>
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                          {board.title}
                      </h3>
                      <div className="flex items-center mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          <span suppressHydrationWarning>
                            {new Date(board.updated_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                      </div>
                  </div>
              </div>

              <div className={cn(
                  "absolute", 
                  viewMode === 'grid' ? "top-2 right-2" : "right-4"
              )}>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 bg-card/80 backdrop-blur-sm"
                          >
                              <MoreHorizontal className="w-4 h-4" />
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                              setRenameId(board.id);
                              setRenameTitle(board.title);
                          }}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(board.id)}
                          >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
              </div>
            </div>
          ))}

          {filteredWhiteboards.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No boards found</h3>
              <p className="text-muted-foreground mt-1">Try searching for something else or create a new board.</p>
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Rename Board</DialogTitle>
                <DialogDescription>
                    Enter a new name for your whiteboard.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="name" className="mb-2 block">Name</Label>
                <Input 
                    id="name"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    autoFocus
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setRenameId(null)}>Cancel</Button>
                <Button onClick={handleRename} disabled={isPending}>Save Changes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

