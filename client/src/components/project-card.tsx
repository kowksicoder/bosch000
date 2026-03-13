import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, TrendingUp } from "lucide-react";
import type { Project } from "@shared/schema";

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <Card
      className="overflow-hidden hover-elevate active-elevate-2 transition-all duration-200 cursor-pointer"
      onClick={onClick}
      data-testid={`card-project-${project.id}`}
    >
      {project.thumbnailUrl && (
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={project.thumbnailUrl}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <h3 className="font-bold text-lg line-clamp-1" data-testid={`text-project-title-${project.id}`}>
            {project.title}
          </h3>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}
        </div>

        {project.category && (
          <Badge variant="secondary" className="text-xs">
            {project.category}
          </Badge>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span data-testid={`text-views-${project.id}`}>
              {project.totalViews?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            <span data-testid={`text-interactions-${project.id}`}>
              {project.totalInteractions?.toLocaleString() || 0}
            </span>
          </div>
        </div>

        {project.isMinted && (
          <Badge className="bg-primary text-primary-foreground">
            Minted
          </Badge>
        )}
      </div>
    </Card>
  );
}
