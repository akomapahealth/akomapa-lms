import Image from "next/image";
import Link from "next/link";
import { IconBadge } from "./icon-badge";
import { BookOpen } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { CourseProgress } from "./course-progress";

interface CourseCardProps {
    id: string;
    title: string;
    imageUrl: string;
    topicsLength: number;
    price: number;
    progress: number | null;
    category: string;
}

export const CourseCard = ({
    id,
    title,
    imageUrl,
    topicsLength,
    price,
    progress,
    category
}: CourseCardProps) => {
    return (
        <Link href={`/courses/${id}`}>
            <div className="group h-full overflow-hidden rounded-xl border border-border/70 bg-card p-3 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-akomapa-teal/40 hover:shadow-lift">
                <div className="relative w-full aspect-video rounded-md overflow-hidden">
                    <Image 
                        fill
                        className="object-cover"
                        alt={title}
                        src={imageUrl}
                    />
                </div>
                <div className="flex flex-col pt-2">
                    <div className="text-lg md:text-base font-medium group-hover:text-akomapa-teal transition line-clamp-2">
                        {title}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {category}
                    </p>
                    <div className="my-3 flex items-center gap-x-2 text-sm md:text-xs">
                        <div className="flex items-center gap-x-1 text-muted-foreground">
                            <IconBadge size="sm" icon={BookOpen} />
                            <span>
                                {topicsLength} {topicsLength === 1 ? "Topic" : "Topics"}
                            </span>
                        </div>
                    </div>
                    {progress !== null ? (
                        <CourseProgress 
                            size="sm"
                            value={progress}
                            variant={progress === 100 ? "success" : "default"}
                        />
                    ) : (
                        <p className="text-md md:text-sm font-medium text-muted-foreground">
                            {formatPrice(price)}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    )
}